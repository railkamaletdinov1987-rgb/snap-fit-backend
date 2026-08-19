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

async function callGeminiWithRetry(apiKey, promptText, retries = 2, delay = 15000) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
    
    for (let i = 0; i <= retries; i++) {
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
        });

        const data = await apiResponse.json();

        // Если всё успешно, возвращаем результат
        if (apiResponse.ok) {
            return { success: true, data };
        }

        // Если уперлись в лимит (429) и это еще не последняя попытка — ждем и повторяем
        if (apiResponse.status === 429 && i < retries) {
            console.log(`⚠️ Превышен лимит (429), ждем ${delay / 1000} сек. перед повтором...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
        }

        // Любая другая ошибка
        return { success: false, status: apiResponse.status, error: data.error?.message || JSON.stringify(data) };
    }
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

        const result = await callGeminiWithRetry(apiKey, promptText);

        if (!result.success) {
            return res.status(result.status || 500).json({ success: false, error: result.error });
        }

        const textOutput = result.data.candidates?.[0]?.content?.parts?.[0]?.text || "Не удалось получить ответ.";
        res.json({ success: true, text: textOutput });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message || String(error) });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Сервер запущен на порту ${PORT}`));
