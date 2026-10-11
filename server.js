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

    const merchantCode = process.env.TWOCHECKOUT_MERCHANT_CODE || '2CHECKOUT_MERCHANT_CODE';

    // Створення прямого кошика з динамічним товаром для 2Checkout
    const checkoutUrl = new URL('https://secure.2checkout.com/checkout/buy');
    
    checkoutUrl.searchParams.append('merchant', merchantCode);
    checkoutUrl.searchParams.append('currency', 'EUR');
    checkoutUrl.searchParams.append('tpl', 'default');
    
    // Передаємо товар динамічно
    checkoutUrl.searchParams.append('prod', prodName);
    checkoutUrl.searchParams.append('price', price);
    checkoutUrl.searchParams.append('qty', '1');
    checkoutUrl.searchParams.append('type', 'digital');
    
    // Кастомні мітки для повернення та ідентифікації користувача
    checkoutUrl.searchParams.append('merchant-order-id', `${userId}-${plan}-${Date.now()}`);
    checkoutUrl.searchParams.append('return-url', `${req.headers.origin}?payment=success`);
    checkoutUrl.searchParams.append('return-type', 'redirect');

    res.json({ url: checkoutUrl.toString() });
});
