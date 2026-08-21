import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/test', (req, res) => {
    res.send('Сервер работает!');
});

app.post('/api/analyze', async (req, res) => {
    try {
        const { gender, age, height, weight, goal, location, durationMonths } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ success: false, error: "GEMINI_API_KEY не найден в .env" });
        }

        const promptText = `Составь детальный и мотивирующий персональный план тренировок и питания на ${durationMonths || 3} месяца.
Параметры пользователя:
- Пол: ${gender}
- Возраст: ${age} лет
- Рост: ${height} см
- Вес: ${weight} кг
- Цель: ${goal}
- Локация: ${location}

Разбей план по неделям и дням недели (например, День 1, День 2 и т.д.), распиши упражнения, подходы, повторения и дай рекомендации по питанию.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
        
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            return res.status(apiResponse.status).json({
                success: false,
                error: data.error?.message || JSON.stringify(data)
            });
        }

        const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "Не удалось получить ответ.";
        res.json({ success: true, text: textOutput });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message || String(error) });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Сервер запущен на порту ${PORT}`));
