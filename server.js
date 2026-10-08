const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const langNames = {
  'uk': 'Ukrainian',
  'sq': 'Albanian',
  'en': 'English',
  'fr': 'French',
  'it': 'Italian',
  'pl': 'Polish',
  'de': 'German'
};

// 1. Маршрут перекладу
app.post('/api/translate', async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;
    const srcName = langNames[sourceLang] || 'auto-detected language';
    const tgtName = langNames[targetLang] || 'Albanian';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the given text from ${srcName} to ${tgtName}. Provide ONLY the direct translation without any explanations or comments.`
        },
        { role: 'user', content: text }
      ]
    });

    const translation = completion.choices[0].message.content.trim();
    res.json({ translation });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// 2. Маршрут для озвучення через OpenAI TTS
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy', // Доступні голоси: alloy, echo, fable, onyx, nova, shimmer
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: 'TTS generation failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
