const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// Налаштування 2Checkout (Verifone)
// Вкажіть ваші дані з облікового запису 2Checkout:
const TWOCHECKOUT_MERCHANT_CODE = process.env.TWOCHECKOUT_MERCHANT_CODE || '2CHECKOUT_MERCHANT_CODE';
const TWOCHECKOUT_SECRET_KEY = process.env.TWOCHECKOUT_SECRET_KEY || '2CHECKOUT_SECRET_KEY';

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

// Реєстрація та синхронізація користувачів
app.post('/api/register-user', (req, res) => {
    const { userId, balance } = req.body;
    if (!userId) return res.status(400).json({ error: 'No userId provided' });

    const users = getUsers();
    const isTester = ['7848', '5231'].includes(String(userId));

    if (!users[userId]) {
        users[userId] = {
            id: userId,
            balance: isTester ? 'Безліміт' : (balance ?? 15),
            status: isTester ? 'Тестувальник' : 'Ззвичайний',
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

// API: Генерування посилання на оплату 2Checkout (Verifone)
app.post('/api/create-2checkout-payment', (req, res) => {
    const { userId, plan } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    let price = '1.00';
    let prodName = 'Solo Безлім (1 місяць)';

    if (plan === 'duo') {
        price = '2.00';
        prodName = 'Duo Earbuds Paket (333 переклади)';
    }

    // Формування URL для 2Checkout Standard/Convert Plus Checkout
    const checkoutUrl = new URL('https://secure.2checkout.com/checkout/buy');
    checkoutUrl.searchParams.append('sid', TWOCHECKOUT_MERCHANT_CODE);
    checkoutUrl.searchParams.append('mode', '2CO');
    checkoutUrl.searchParams.append('li_0_type', 'product');
    checkoutUrl.searchParams.append('li_0_name', prodName);
    checkoutUrl.searchParams.append('li_0_price', price);
    checkoutUrl.searchParams.append('currency_code', 'EUR');
    checkoutUrl.searchParams.append('custom_user_id', userId);
    checkoutUrl.searchParams.append('custom_plan', plan);
    
    const returnUrl = `${req.headers.origin}?payment=success`;
    checkoutUrl.searchParams.append('x_receipt_link_url', returnUrl);

    res.json({ url: checkoutUrl.toString() });
});

// Webhook / INS / IPN (Instant Notification Service) від 2Checkout
app.post('/api/2checkout-webhook', (req, res) => {
    const data = req.body;
    const userId = data.custom_user_id;
    const plan = data.custom_plan;

    // Перевірка успішності платежу від 2Checkout
    if (data.invoice_status === 'approved' || data.fraud_status === 'pass' || data.credit_card_processed === 'Y') {
        if (userId) {
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
    }

    res.send('2COMM_APPROVED');
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
