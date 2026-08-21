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

// Эндпоинт генерации плана тренировок
app.post('/api/analyze', async (req, res) => {
    try {
        const { gender, age, height, weight, goal, location, durationMonths } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ success: false, error: "GEMINI_API_KEY не найден в .env" });
        }

        const promptText = `Составь детальный персональный план тренировок и питания на ${durationMonths} месяцев.
Параметры пользователя:
- Пол: ${gender}
- Возраст: ${age} лет
- Рост: ${height} см
- Вес: ${weight} кг
- Цель: ${goal}
- Локация: ${location}

Разбей план по месяцам и неделям (День 1, День 2, День 3), укажи упражнения, подходы, повторения и рекомендации по воде и калориям.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
        
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            return res.status(apiResponse.status).json({ success: false, error: data.error?.message || JSON.stringify(data) });
        }

        const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "Не удалось получить ответ.";
        res.json({ success: true, text: textOutput });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message || String(error) });
    }
});

// Эндпоинт умного подсчета калорий по фото или описанию блюда
app.post('/api/calories', async (req, res) => {
    try {
        const { foodDescription, imageBase64 } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ success: false, error: "GEMINI_API_KEY не найден" });
        }

        const parts = [];
        parts.push({ text: `Оцени состав съеденного блюда. Описание: "${foodDescription || 'Блюдо на фото'}". Верни ответ строго в формате JSON без лишних слов: {"name": "Название блюда", "calories": число_ккал, "protein": белки_гр, "fat": жиры_гр, "carbs": углеводы_гр, "advice": "краткий комментарий ИИ"}` });

        if (imageBase64) {
            const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: base64Data
                }
            });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
        
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }] })
        });

        const data = await apiResponse.json();
        if (!apiResponse.ok) {
            return res.status(apiResponse.status).json({ success: false, error: data.error?.message });
        }

        let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonResult = JSON.parse(rawText);

        res.json({ success: true, data: jsonResult });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Сервер запущен на порту ${PORT}`));
