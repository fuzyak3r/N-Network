const axios = require('axios');
const cheerio = require('cheerio');
const http = require('http');
const url = require('url');

// Функция для очистки content от тегов и префиксов
function cleanContent(content) {
    let plainText = content.replace(/<[^>]+>/g, '');
    plainText = plainText.replace(/^\d+\.\s*/, '');
    return plainText.trim();
}

// Основная функция
async function fetchTestData(uuid) {
    try {
        const testPageResponse = await axios.get(`https://naurok.com.ua/test/testing/${uuid}`);
        const html = testPageResponse.data;

        const $ = cheerio.load(html);
        const ngInit = $('div[ng-controller="TestCtrl"]').attr('ng-init');
        if (!ngInit) {
            throw new Error('Не удалось найти ng-init в HTML');
        }

        const sessionIdMatch = ngInit.match(/init\(\d+,\s*(\d+),\s*\d+\)/);
        if (!sessionIdMatch || !sessionIdMatch[1]) {
            throw new Error('Не удалось извлечь session_id из ng-init');
        }

        const session_id = sessionIdMatch[1];

        const sessionResponse = await axios.get(`https://naurok.com.ua/api2/test/sessions/${session_id}`);
        const data = sessionResponse.data;

        return {
            session: data.session,
            settings: data.settings,
            document: data.document,
            questions: data.questions.map(question => ({
                ...question,
                cleanContent: cleanContent(question.content),
                options: question.options.map(option => ({
                    ...option,
                    cleanValue: cleanContent(option.value)
                }))
            }))
        };

    } catch (error) {
        console.error('Ошибка:', error.message);
        return { error: error.message };
    }
}

// HTTP-сервер
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/uuid' && parsedUrl.query.q) {
        const query = parsedUrl.query.q;
        console.log(`Запрос: ${query}`);

        try {
            const result = await fetchTestData(query);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ query, result }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: "Ошибка сервера: " + error.message }));
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Используйте http://localhost:8080/uuid?q={uuid}');
    }
});

server.listen(8080, () => {
    console.log('Сервер запущен на http://localhost:8080');
});
