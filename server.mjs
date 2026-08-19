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

async function callGeminiApi(modelName, apiKey, parts) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
    });
}

app.post('/api/analyze', async (req, res) => {
    try {
        const { gender, age, height, weight, goal, location, durationMonths } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ success: false, error: "GEMINI_API_KEY не найден в .env" });
        }

        const promptText = `Проанализируй физические данные:
- Пол: ${gender}
- Возраст: ${age} лет
- Рост: ${height} см
- Вес: ${weight} кг
- Цель: ${goal}
- Локация: ${location}
- Срок программы: ${durationMonths} мес.

Дай 3 детальных персональных совета по питанию и прогрессии нагрузок под эти параметры.`;

        const parts = [{ text: promptText }];

        // Список моделей для автопробы
        const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
        let apiResponse = null;
        let lastError = null;

        for (const model of modelsToTry) {
            console.log(`Пробуем модель: ${model}`);
            const resApi = await callGeminiApi(model, apiKey, parts);
            if (resApi.ok) {
                apiResponse = resApi;
                break;
            } else {
                lastError = await resApi.json();
            }
        }

        if (!apiResponse || !apiResponse.ok) {
            return res.status(500).json({
                success: false,
                error: "Не удалось подобрать рабочую модель. Ошибка: " + JSON.stringify(lastError)
            });
        }

        const data = await apiResponse.json();
        const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "Не удалось получить ответ.";
        res.json({ success: true, text: textOutput });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message || String(error) });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Сервер запущен на порту ${PORT}`));
