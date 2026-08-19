import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ТЕСТОВЫЙ МАРШРУТ (GET)
app.get('/test', (req, res) => {
    res.send('Сервер работает!');
});

// Вспомогательная функция отправки запроса
async function callGeminiApi(modelName, apiKey, parts) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    console.log(`🚀 Отправка запроса к модели: ${modelName}`);
    
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

        // Используем самую актуальную стабильную модель gemini-3.6-flash
        let apiResponse = await callGeminiApi('gemini-3.6-flash', apiKey, parts);

        // Если модель недоступна, пробуем запасной вариант gemini-1.5-flash
        if (!apiResponse.ok) {
            const errData = await apiResponse.json();
            console.log('⚠️ Ошибка с gemini-3.6-flash, пробуем gemini-1.5-flash...', errData);
            
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
