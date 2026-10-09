const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ЦЕЙ РЯДОК ОБОВ'ЯЗКОВИЙ: дозволяє браузеру завантажувати manifest.json, icon-192.png, icon-512.png
app.use(express.static('.'));

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Головна сторінка
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Ендпоінт перекладу (GPT-4o-mini)
app.post('/api/translate', async (req, res) => {
    try {
        const { text, sourceLang, targetLang } = req.body;
        
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a professional translator. Translate text from ${sourceLang} to ${targetLang}. Preserve tone and meaning naturally.`
                },
                {
                    role: "user",
                    content: text
                }
            ],
            temperature: 0.3
        });

        res.json({ translation: response.choices[0].message.content.trim() });
    } catch (error) {
        console.error("Translation Error:", error);
        res.status(500).json({ error: "Translation failed" });
    }
});

// Ендпоінт генерації голосу (OpenAI TTS)
app.post('/api/tts', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "No text provided" });

        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: text
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(buffer);
    } catch (error) {
        console.error("TTS Error:", error);
        res.status(500).json({ error: "TTS failed" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
