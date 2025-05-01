const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const express = require('express');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-notifications',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=IdleDetection',
      '--no-zygote',
      '--disable-ipc-flooding-protection',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-background-media-suspend',
      // '--headless=new',
    ],    
    defaultViewport: null,
  });
  
  const loginPage = await browser.newPage();
  await loginPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
  loginPage.on('dialog', async (dialog) => {
    console.log('Диалог:', dialog.message());
    await dialog.dismiss();
  });

  try {
    await login(loginPage);
    await delay(2000);
    console.log('Авторизация завершена, URL:', loginPage.url());

    const maxPages = 5; // Устанавливаем 5 для теста
    const pagePool = [];
    for (let i = 0; i < maxPages; i++) {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
      page.on('dialog', async (dialog) => {
        console.log('Диалог:', dialog.message());

        // Если диалог — это подтверждение "Зупинити", принимаем его
        if (dialog.message().includes('Ви впевнені, що бажаєте зупинити домашнє завдання?')) {
          console.log('Подтверждаем "Зупинити"');
          await dialog.accept();  // Подтверждаем "Зупинити"
        }
        
        // Если диалог — это подтверждение "Видалити", принимаем его
        else if (dialog.message().includes('Ви впевнені, що бажаєте видалити домашнє завдання?')) {
          console.log('Подтверждаем "Видалити"');
          await dialog.accept();  // Подтверждаем "Видалити"
        } else {
          console.log("ПОхуй соглашаемься на диалог");
          await dialog.accept()
        }

      });
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
        Object.defineProperty(document, 'hidden', { value: false, writable: true });
      });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      pagePool.push({ page, busy: false, id: i });
    }
    console.log(`Создан пул из ${maxPages} страниц`);

    const processTest = async (testName) => {
      const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Таймаут')), ms));
      const availablePage = await new Promise((resolve) => {
        const check = () => {
          const freePage = pagePool.find((p) => !p.busy);
          if (freePage) {
            freePage.busy = true;
            console.log(`Выбрана страница ${freePage.id} для ${testName}`);
            resolve(freePage);
          } else {
            console.log(`Ожидание свободной страницы для ${testName}`);
            setTimeout(check, 100);
          }
        };
        check();
      });

      try {
        const answers = await Promise.race([runTest(availablePage.page, testName), timeout(120000)]); // Увеличиваем до 2 минут
        console.log(`[${testName}] Успешно обработано на странице ${availablePage.id}`);
        return { testName, answers };
      } catch (error) {
        console.error(`[${testName}] Ошибка на странице ${availablePage.id}:`, error.message);
        return { testName, error: error.message };
      } finally {
        availablePage.busy = false;
        console.log(`Страница ${availablePage.id} освобождена для ${testName}`);
      }
    };

    const app = express();
    app.use(express.json());

    app.post('/test', async (req, res) => {
      const { testName } = req.body;
      if (!testName) return res.status(400).json({ error: 'testName required' });
      console.log(`Получен запрос для ${testName}`);
      const result = await processTest(testName);
      res.json(result);
    });

    app.listen(3000, () => console.log('API запущен на порту 3000'));
  } catch (error) {
    console.error('Ошибка при запуске:', error.message);
    await browser.close();
  }
})();

async function login(page) {
  console.log('Переход на страницу логина');
  await page.goto('https://naurok.com.ua/login', { waitUntil: 'domcontentloaded' });

  const cookiesSelector = 'button[id*="accept"], button[class*="accept"], [aria-label*="accept"]';
  if (await page.$(cookiesSelector)) {
    console.log('Принимаем cookies');
    await page.click(cookiesSelector);
    await page.waitForNetworkIdle({ idleTime: 500 });
  }

  console.log('Ожидание reCAPTCHA');
  await page.waitForFunction('typeof grecaptcha !== "undefined"', { timeout: 15000 });
  await simulateHumanBehavior(page);

  console.log('Извлечение CSRF-токена');
  const csrfToken = await page.$eval('input[name="_csrf"]', (el) => el.value);
  console.log('CSRF-токен:', csrfToken);

  console.log('Получение reCAPTCHA-токена');
  const reCaptchaToken = await page.evaluate(() => {
    return new Promise((resolve) => {
      grecaptcha.ready(() => {
        grecaptcha.execute('6Lfj5vQUAAAAAOjsdAMk32BeA8J-E7c86_GWFvco', { action: 'login' }).then(resolve);
      });
    });
  });
  console.log('reCAPTCHA-токен:', reCaptchaToken);

  console.log('Ввод учетных данных');
  await page.type('input[name="LoginForm[login]"]', 'chkalovua@email.ua', { delay: 50 });
  await page.type('input[name="LoginForm[password]"]', '3UKkWa8ySkwC3u5', { delay: 50 });

  await page.evaluate((csrf, recaptcha) => {
    document.querySelector('input[name="_csrf"]').value = csrf;
    document.querySelector('#loginform-recaptcha').value = recaptcha;
  }, csrfToken, reCaptchaToken);

  console.log('Отправка формы');
  await simulateClick(page, 'button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });

  const currentUrl = page.url();
  console.log('Текущий URL после авторизации:', currentUrl);
  if (currentUrl.includes('/login')) {
    const content = await page.content();
    console.log('HTML страницы:', content.substring(0, 500));
    throw new Error('Авторизация не удалась');
  }
}

async function runTest(page, testName) {
  console.log(`[${testName}] Загрузка страницы теста`);
  await page.goto(`https://naurok.com.ua/test/${testName}/set`, { waitUntil: 'domcontentloaded' });

  await page.bringToFront();
  await page.evaluate(() => window.focus());

  console.log(`[${testName}] Эмуляция поведения`);
  await simulateHumanBehavior(page);

  console.log(`[${testName}] Ожидание кнопки создания теста`);
  await page.waitForSelector('button.btn-orange.btn-block', { visible: true, timeout: 10000 });
  await page.evaluate(() => document.querySelector('button.btn-orange.btn-block').scrollIntoView({ behavior: 'smooth' }));

  console.log(`[${testName}] Клик по кнопке создания теста`);
  await page.click('button.btn-orange.btn-block');
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
  const homeworkUrl = page.url();
  console.log(`[${testName}] URL домашнего задания: ${homeworkUrl}`);

  const joinLink = await page.$eval('input.form-control[readonly]', (el) => el.value);
  console.log(`[${testName}] Переход по ссылке: ${joinLink}`);
  await page.goto(joinLink, { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('#joinform-name', { timeout: 10000 });
  await page.type('#joinform-name', 'TestUser' + Math.random().toString(36).substring(7), { delay: 50 });
  await page.click('button.join-button-test');
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

  const totalQuestions = await page.$eval('.numberQuestionsLeft .ng-binding:last-child', (el) => parseInt(el.textContent.trim()));
  await page.waitForSelector('.test-option', { timeout: 10000 });
  await page.click('.test-option:first-child');
  await delay(1000);

  await page.waitForSelector('.endSessionButton', { timeout: 10000 });
  await page.click('.endSessionButton');
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

  await page.evaluate(async () => {
    for (let i = 0; i < 5; i++) {
      window.scrollBy(0, 1000);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  });

  const answers = await extractAnswers(page);
  if (answers.length !== totalQuestions) {
    console.warn(`[${testName}] Извлечено ${answers.length} ответов из ${totalQuestions}.`);
  }

  console.log(`[${testName}] Переход для удаления: ${homeworkUrl}`);
  await page.goto(homeworkUrl, { waitUntil: 'domcontentloaded' });

  console.log(`[${testName}] Ожидание кнопки "Зупинити"`);
  await page.waitForSelector('a.btn.btn-block.btn-danger[href$="/stop"]', { visible: true, timeout: 10000 });
  await page.click('a.btn.btn-block.btn-danger[href$="/stop"]'); // Нажимаем "Зупинити"
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });

  await delay(1000); // Ждём 1 секунду

  console.log(`[${testName}] Ожидание кнопки "Видалити"`);
  await page.waitForSelector('a.btn.btn-block.btn-danger.btn-xs[href$="/delete"]', { visible: true, timeout: 10000 });
  await page.click('a.btn.btn-block.btn-danger.btn-xs[href$="/delete"]'); // Нажимаем "Видалити"
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });

  console.log(`[${testName}] Тест удалён`);

  return answers;
}

async function extractAnswers(page) {
  return await page.evaluate(() => {
    const blocks = document.querySelectorAll('.content-block');
    const result = [];
    blocks.forEach((block) => {
      const questionText = block.querySelector('p')?.textContent.trim();
      const questionStrong = block.querySelector('strong')?.textContent.trim();
      const question = questionStrong || questionText || 'Вопрос не найден';
      const img = block.querySelector('img')?.getAttribute('src') || null;
      const correctOptions = Array.from(block.querySelectorAll('.homework-stat-option-value.correct p'))
        .map((el) => el.textContent.trim());
      if (correctOptions.length > 0) {
        result.push({
          question,
          img,
          answer: correctOptions.length > 1 ? correctOptions : correctOptions[0],
        });
      }
    });
    return result;
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function simulateHumanBehavior(page) {
  await page.mouse.move(100, 100, { steps: 10 });
  await delay(randomDelay(300, 800));
  await page.mouse.click(100, 100);
  await page.mouse.move(200, 300, { steps: 15 });
  await delay(randomDelay(500, 1200));
  await page.evaluate(() => window.scrollBy(0, 200));
  await delay(randomDelay(400, 900));
}

async function simulateClick(page, selector) {
  const element = await page.$(selector);
  if (!element) throw new Error(`Элемент с селектором ${selector} не найден`);
  await page.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), element);
  await delay(randomDelay(200, 500));
  const box = await element.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
  await delay(randomDelay(100, 300));
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await delay(randomDelay(200, 400));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}