const express = require('express');
const path = path = require('path');

const app = express(); // 🟢 Оголошуємо об'єкт app рівно один раз

// Middleware для обробки JSON-запитів
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Роздача статичних файлів (index.html, manifest.json, іконки тощо) з кореневої папки
app.use(express.static(path.join(__dirname)));

// Ендпоінт для створення платежу через 2Checkout (Verifone)
app.post('/api/create-2checkout-payment', (req, res) => {
    const { userId, plan } = req.body;
    
    // Визначення суми залежно від обраного тарифу
    const amount = plan === 'duo' ? '2.00' : '1.00';
    
    // Тут формується відповідь із посиланням на платіжний шлюз 2Checkout
    // (Можете замінити параметри на свої реальні дані продавця з Verifone)
    res.json({ 
        success: true, 
        url: `https://secure.2checkout.com/checkout/buy?merchant=YOUR_MERCHANT&prod=${plan}&price=${amount}&custom_field=${userId}` 
    });
});

// Універсальний маршрут (Catch-all) для коректної роботи PWA та клієнтських посилань
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Запуск сервера на порту Render або локально (порт 3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running smoothly on port ${PORT}`);
});
