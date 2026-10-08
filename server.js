const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

app.post('/api/translate', async (req, res) => {
    try {
        const { text, targetLang } = req.body;

        const systemPrompt = targetLang === 'sq' 
            ? 'You are a professional translator. Translate the given text into natural Albanian. Reply ONLY with the translation.'
            : 'You are a professional translator. Translate the given text into natural Ukrainian. Reply ONLY with the translation.';

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ]
        });

        res.json({ translation: response.choices[0].message.content.trim() });
    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({ error: 'Translation failed' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
