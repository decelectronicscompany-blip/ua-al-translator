const express = require('express');
const path = require('path');

const app = express();

// Middleware для обробки JSON-запитів
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Роздача статичних файлів з кореневої папки
app.use(express.static(path.join(__dirname)));

// Ендпоінт для створення платежу через 2Checkout (Verifone)
app.post('/api/create-2checkout-payment', (req, res) => {
    const { userId, plan } = req.body;
    const amount = plan === 'duo' ? '2.00' : '1.00';
    
    res.json({ 
        success: true, 
        url: `https://secure.2checkout.com/checkout/buy?merchant=YOUR_MERCHANT&prod=${plan}&price=${amount}&custom_field=${userId}` 
    });
});

// Універсальний маршрут для PWA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running smoothly on port ${PORT}`);
});
