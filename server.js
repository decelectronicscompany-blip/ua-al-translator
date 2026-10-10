const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('.'));

const USERS_FILE = path.join(__dirname, 'users.json');

// Читання файлу користувачів
function getUsers() {
    if (!fs.existsSync(USERS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

// Збереження користувачів у файл
function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving users file:', e);
    }
}

// Реєстрація та синхронізація користувача
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

// Секретна сторінка адміна для перегляду користувачів
app.get('/admin-users', (req, res) => {
    const users = getUsers();
    const userList = Object.values(users);

    const html = `
    <!DOCTYPE html>
    <html lang="uk">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Список користувачів | Voice Translator</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #030706; color: #f8fafc; padding: 24px; margin: 0; }
            .container { max-width: 900px; margin: 0 auto; }
            h2 { color: #34d399; margin-bottom: 20px; font-size: 24px; }
            .stats { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); padding: 12px 18px; border-radius: 14px; display: inline-block; margin-bottom: 20px; font-weight: 700; color: #34d399; }
            table { width: 100%; border-collapse: collapse; background: rgba(10, 30, 22, 0.6); border: 1px solid rgba(52, 211, 153, 0.2); border-radius: 16px; overflow: hidden; }
            th, td { border-bottom: 1px solid rgba(52, 211, 153, 0.1); padding: 14px; text-align: left; font-size: 14px; }
            th { background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 800; }
            tr:last-child td { border-bottom: none; }
            .badge-tester { color: #34d399; font-weight: 800; background: rgba(52, 211, 153, 0.15); padding: 4px 8px; border-radius: 8px; width: fit-content; }
            .badge-user { color: #94a3b8; }
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
                        <th>Перший захід</th>
                        <th>Остання активність</th>
                    </tr>
                </thead>
                <tbody>
                    ${userList.length === 0 ? '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Поки немає зареєстрованих користувачів</td></tr>' : ''}
                    ${userList.map(u => `
                        <tr>
                            <td><b>ID ${u.id}</b></td>
                            <td><span class="${u.status === 'Тестувальник' ? 'badge-tester' : 'badge-user'}">${u.status}</span></td>
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

// Роути для перекладу та TTS (якщо вони у вас у server.js)
app.post('/api/translate', async (req, res) => {
    try {
        const { text, sourceLang, targetLang } = req.body;
        // Тут ваша логіка перекладу...
        res.json({ translation: text }); 
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
