import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Вспомогательная функция отправки запроса
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
        const { gender, age, height, weight, goal, location, durationMonths, photoBase64 } = req.body;
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

        if (photoBase64) {
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: photoBase64
                }
            });
        }

        // 1. Пробуем актуальную быструю модель
        let apiResponse = await callGeminiApi('gemini-2.5-flash', apiKey, parts);

        // 2. Если перегружена (503 или 429), пробуем резервную
        if (!apiResponse.ok && (apiResponse.status === 503 || apiResponse.status === 429)) {
            console.log('⚠️ Основная модель перегружена, переключаемся на резервную модель...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            apiResponse = await callGeminiApi('gemini-1.5-flash', apiKey, parts);
        }

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error('❌ Ошибка от Gemini API:', data);
            return res.status(apiResponse.status).json({
                success: false,
                error: data.error?.message || JSON.stringify(data)
            });
        }

        const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "Не удалось получить ответ.";
        res.json({ success: true, text: textOutput });

    } catch (error) {
        console.error('❌ Ошибка сервера:', error);
        res.status(500).json({ success: false, error: error.message || String(error) });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Сервер запущен на порту ${PORT}`));