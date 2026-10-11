const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

const TWOCHECKOUT_MERCHANT_CODE = process.env.TWOCHECKOUT_MERCHANT_CODE || '2CHECKOUT_MERCHANT_CODE';
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
    } catch (e) {}
}

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

app.post('/api/create-2checkout-payment', (req, res) => {
    const { userId, plan } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    let price = '1.00';
    let prodName = 'Solo Безлім (1 місяць)';

    if (plan === 'duo') {
        price = '2.00';
        prodName = 'Duo Earbuds Paket (333 переклади)';
    }

    const checkoutUrl = new URL('https://secure.2checkout.com/checkout/buy');
    checkoutUrl.searchParams.append('merchant', TWOCHECKOUT_MERCHANT_CODE);
    checkoutUrl.searchParams.append('currency', 'EUR');
    checkoutUrl.searchParams.append('tpl', 'default');
    checkoutUrl.searchParams.append('prod', prodName);
    checkoutUrl.searchParams.append('price', price);
    checkoutUrl.searchParams.append('qty', '1');
    checkoutUrl.searchParams.append('type', 'digital');
    checkoutUrl.searchParams.append('merchant-order-id', `${userId}-${plan}-${Date.now()}`);
    checkoutUrl.searchParams.append('return-url', `${req.headers.origin}?payment=success`);
    checkoutUrl.searchParams.append('return-type', 'redirect');

    res.json({ url: checkoutUrl.toString() });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
