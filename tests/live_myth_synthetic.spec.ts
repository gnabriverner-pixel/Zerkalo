import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// DO NOT USE REAL USER DOB — this live acceptance spec sends only the
// documented synthetic smoke fixture (see server/production_smoke_fixture.test.ts).
const SYNTHETIC_SMOKE_DOB = '01.07.1990';
const [DOB_DAY, DOB_MONTH, DOB_YEAR] = SYNTHETIC_SMOKE_DOB.split('.');

test.describe('Live Personal Myth Generation (synthetic fixture)', () => {
  test('Live RouterAI Myth Generation & Verification', async ({ page }) => {
    test.setTimeout(180000);

    const outDir = path.resolve(process.cwd(), 'output/owner_evidence');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      // Ensure no secrets are captured
      if (!text.includes('sk-') && !text.includes('Bearer')) {
        consoleLogs.push(`[${msg.type()}] ${text}`);
      }
    });

    let mythApiResponse: any = null;
    let mythApiStatus: number | null = null;

    page.on('response', async (res) => {
      if (res.url().includes('/api/personal-myth')) {
        mythApiStatus = res.status();
        try {
          const json = await res.json();
          mythApiResponse = json;
        } catch (e) {
          console.error('Failed to parse /api/personal-myth response JSON');
        }
      }
    });

    console.log('Navigating to http://localhost:3088...');
    await page.goto('http://localhost:3088', { waitUntil: 'networkidle' });

    // 1. Consent modal if visible
    const consentCheckbox = page.getByRole('checkbox');
    if (await consentCheckbox.isVisible()) {
      console.log('Checking consent checkbox...');
      await consentCheckbox.check();
      const continueBtn = page.getByRole('button', { name: 'Продолжить к зеркалам' });
      await continueBtn.click();
      await page.waitForTimeout(500);
    }

    // 2. Date input for the synthetic fixture (DO NOT USE REAL USER DOB)
    console.log(`Filling synthetic DOB ${SYNTHETIC_SMOKE_DOB}...`);
    const dayInput = page.getByPlaceholder('ДД', { exact: true });
    const monthInput = page.getByPlaceholder('ММ', { exact: true });
    const yearInput = page.getByPlaceholder('ГГГГ', { exact: true });

    await dayInput.waitFor({ state: 'visible' });
    await dayInput.fill(DOB_DAY);
    await monthInput.fill(DOB_MONTH);
    await yearInput.fill(DOB_YEAR);

    const calcBtn = page.getByRole('button', { name: 'Рассчитать код', exact: true });
    await calcBtn.click();

    // Wait for code calculation
    console.log('Waiting for code calculation...');
    const toMythBtn = page.getByRole('button', { name: 'Перейти к Личному мифу' });
    await toMythBtn.waitFor({ state: 'visible', timeout: 30000 });
    await toMythBtn.click();
    await page.waitForTimeout(600);

    // 3. Enter Personal Myth
    console.log('Entering Personal Myth...');
    const startMythBtn = page.getByRole('button', { name: 'Войти через образы', exact: true });
    if (await startMythBtn.isVisible()) {
      await startMythBtn.click();
      await page.waitForTimeout(500);
    }

    // 4. Fill 4 answers
    const steps = [
      {
        tag: '01 / 04',
        answer: 'Много начатых проектов, сложно выбрать одно направление, чувствую рассеивание сил.',
      },
      {
        tag: '02 / 04',
        answer: 'Старый маяк на скалистом берегу, свет которого виден сквозь ночной туман.',
      },
      {
        tag: '03 / 04',
        answer: 'Когда наконец закончил сложный чертеж и в комнате наступила тишина.',
      },
      {
        tag: '04 / 04',
        answer: 'Внутренней ясности и устойчивого фокуса без суеты.',
      },
    ];

    for (let i = 0; i < steps.length; i++) {
      console.log(`Answering step ${steps[i].tag}...`);
      await page.waitForSelector(`text=${steps[i].tag}`, { timeout: 15000 });
      const textarea = page.locator('textarea');
      await textarea.waitFor({ state: 'visible', timeout: 10000 });
      await textarea.fill(steps[i].answer);
      await page.waitForTimeout(300);

      if (i === steps.length - 1) {
        console.log('Submitting myth generation...');
        const submitBtn = page.getByRole('button', { name: 'Соткать историю', exact: true })
          .or(page.getByRole('button', { name: 'Сплести историю' }));
        await submitBtn.first().click();
      } else {
        const nextBtn = page.getByRole('button', { name: 'Далее', exact: true })
          .or(page.getByRole('button', { name: 'Продолжить' }));
        await nextBtn.first().click();
      }
      await page.waitForTimeout(400);
    }

    // 5. Wait for live generation to complete
    console.log('Waiting for live RouterAI generation...');
    const article = page.locator('article');
    await article.waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(1000);

    // Verify API response status & body
    expect(mythApiStatus).toBe(200);
    expect(mythApiResponse).not.toBeNull();
    expect(mythApiResponse.status).toBe('ok');
    expect(mythApiResponse.provider).toBe('routerai');
    expect(mythApiResponse.model).toBe('deepseek/deepseek-v4.1-flash');

    // Extract text from article
    const storyText = await article.innerText();
    const fullPageText = await page.innerText('body');

    // Verify no fallback or stub language exists
    expect(fullPageText).not.toContain('временно недоступен');
    expect(fullPageText).not.toContain('провайдер генерации не настроен');
    expect(fullPageText).not.toContain('ваши ответы сохранены');

    // Extract paragraphs and journal question
    const paragraphs = await article.locator('p').allInnerTexts();
    const journalQuestionEl = page.locator('text=Вопрос для внутренней тишины').locator('..').locator('p');
    let journalQuestion = '';
    if (await journalQuestionEl.isVisible()) {
      journalQuestion = await journalQuestionEl.innerText();
    }

    console.log('--- GENERATED STORY PARAGRAPHS ---');
    paragraphs.forEach((p, idx) => console.log(`[P${idx + 1}]: ${p}\n`));
    console.log(`[Journal Question]: ${journalQuestion}`);

    // Take screenshots
    const mythScreenPath = path.join(outDir, '01_personal_myth_synthetic_live.png');
    const mythArticlePath = path.join(outDir, '02_personal_myth_synthetic_article.png');
    await page.screenshot({ path: mythScreenPath, fullPage: true });
    await article.screenshot({ path: mythArticlePath });

    // Save evidence JSON
    const evidence = {
      timestamp: new Date().toISOString(),
      dob: SYNTHETIC_SMOKE_DOB,
      inputs: steps.map((s) => ({ step: s.tag, answer: s.answer })),
      api: {
        status: mythApiStatus,
        provider: mythApiResponse?.provider,
        model: mythApiResponse?.model,
        writer_version: mythApiResponse?.writer_version,
        qa: mythApiResponse?.qa,
      },
      story: {
        paragraphs,
        journalQuestion,
        raw_text: storyText,
      },
      verification: {
        no_fallback_text: true,
        no_provider_error: true,
        word_count: mythApiResponse?.qa?.word_count || storyText.split(/\s+/).length,
      },
    };

    fs.writeFileSync(
      path.join(outDir, 'live_myth_synthetic_evidence.json'),
      JSON.stringify(evidence, null, 2),
      'utf-8'
    );

    console.log('Live generation verified successfully!');
  });
});
