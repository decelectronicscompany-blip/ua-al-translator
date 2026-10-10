const express = require('express');
const fs = require('fs');
const path = require('path');
// Вкажіть ваш Секретний ключ Stripe з панелі dashboard.stripe.com
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_SECRET_KEY');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('.'));

// Важливо: для Stripe Webhook потрібен raw body
app.use((req, res, next) => {
    if (req.originalUrl === '/api/stripe-webhook') {
        next();
    } else {
        express.json()(req, res, next);
    }
});

const USERS_FILE = path.join(__dirname, 'users.json');

function getUsers() {
    let users = {};
    if (fs.existsSync(USERS_FILE)) {
        try {
            users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        } catch (e) {
            users = {};
        }
    }

    const defaultTesters = ['7848', '5231'];
    defaultTesters.forEach(id => {
        if (!users[id]) {
            users[id] = {
                id: id,
                balance: 'Безліміт',
                status: 'Тестувальник',
                firstSeen: new Date().toISOString(),
                lastActive: 'Очікує входу'
            };
        }
    });

    return users;
}

function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving users file:', e);
    }
}

// Реєстрація та синхронізація
app.post('/api/register-user', (req, res) => {
    const { userId, balance } = req.body;
    if (!userId) return res.status(400).json({ error: 'No userId provided' });

    const users = getUsers();
    const isTester = ['7848', '5231'].includes(String(userId));

    if (!users[userId]) {
        users[userId] = {
            id: userId,
            balance: isTester ? 'Безліміт' : (balance ?? 15),
            status: isTester ? 'Тестувальник' : 'Звичайний',
            firstSeen: new Date().toISOString(),
            lastActive: new Date().toISOString()
        };
    } else {
        users[userId].lastActive = new Date().toISOString();
        if (!isTester && balance !== undefined) {
            users[userId].balance = balance;
        }
    }

    saveUsers(users);
    res.json({ success: true, user: users[userId] });
});

// API: Створення сесії оплати Stripe
app.post('/api/create-checkout-session', async (req, res) => {
    const { userId, plan } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    let priceAmount = 100; // €1.00 за замовчуванням (в центах)
    let planName = 'Solo Безлім (1 місяць)';

    if (plan === 'duo') {
        priceAmount = 200; // €2.00
        planName = 'Duo Earbuds Paket (333 переклади)';
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: planName,
                            description: `Активація для акаунту ID: ${userId}`,
                        },
                        unit_amount: priceAmount,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            metadata: {
                userId: userId,
                plan: plan
            },
            success_url: `${req.headers.origin}?payment=success`,
            cancel_url: `${req.headers.origin}?payment=cancel`,
        });

        res.json({ url: session.url });
    } catch (e) {
        console.error('Stripe Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Stripe Webhook: автопоповнення після оплати
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Увімкніть перевірку підпису у продакшені
        event = JSON.parse(req.body);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const plan = session.metadata.plan;

        const users = getUsers();
        if (users[userId]) {
            if (plan === 'duo') {
                const current = parseInt(users[userId].balance) || 0;
                users[userId].balance = current + 333;
            } else {
                users[userId].balance = 'Безліміт (Місяць)';
            }
            saveUsers(users);
        }
    }

    res.json({ received: true });
});

// Адмін-панель
app.get('/admin-users', (req, res) => {
    const users = getUsers();
    const userList = Object.values(users);

    const html = `
    <!DOCTYPE html>
    <html lang="uk">
    <head>
        <meta charset="UTF-8">
        <title>Список користувачів | Voice Translator</title>
        <style>
            body { font-family: -apple-system, sans-serif; background: #030706; color: #f8fafc; padding: 24px; }
            .container { max-width: 900px; margin: 0 auto; }
            h2 { color: #34d399; }
            .stats { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); padding: 12px 18px; border-radius: 14px; display: inline-block; margin-bottom: 20px; font-weight: 700; color: #34d399; }
            table { width: 100%; border-collapse: collapse; background: rgba(10, 30, 22, 0.6); border: 1px solid rgba(52, 211, 153, 0.2); border-radius: 16px; overflow: hidden; }
            th, td { border-bottom: 1px solid rgba(52, 211, 153, 0.1); padding: 14px; text-align: left; font-size: 14px; }
            th { background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 800; }
            .badge-tester { color: #34d399; font-weight: 800; background: rgba(52, 211, 153, 0.15); padding: 4px 8px; border-radius: 8px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>📊 Панель управління користувачами</h2>
            <div class="stats">Всього зареєстровано: ${userList.length}</div>
            <table>
                <thead>
                    <tr>
                        <th>ID Користувача</th>
                        <th>Статус</th>
                        <th>Залишок перекладів</th>
                        <th>Перший заход</th>
                        <th>Остання активність</th>
                    </tr>
                </thead>
                <tbody>
                    ${userList.map(u => `
                        <tr>
                            <td><b>ID ${u.id}</b></td>
                            <td><span class="${u.status === 'Тестувальник' ? 'badge-tester' : ''}">${u.status}</span></td>
                            <td><b>${u.balance}</b></td>
                            <td>${new Date(u.firstSeen).toLocaleString('uk-UA')}</td>
                            <td>${new Date(u.lastActive).toLocaleString('uk-UA')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
