import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {personas} from '../scripts/quality/personas';

// UI/transport test with recorded synthetic MODEL outputs. Not a fresh model or Telegram delivery test.
const fixture=JSON.parse(fs.readFileSync('docs/evidence/quality-2026-09/final-18/synthetic_career.json','utf8'));
const persona=personas[0];
test('consent → canonical Code → recorded Myth/Meeting → save/reload → handoff',async({page,context},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.name));
  await page.route('**/api/personal-myth',r=>r.fulfill({json:{mode:'story',status:'ok',story_result:fixture.myth.result}}));
  await page.route('**/api/meeting-of-mirrors',r=>r.fulfill({json:fixture.meeting}));
  await page.route('**/api/lab/meeting/generate',r=>r.fulfill({json:fixture.meeting}));
  await page.route('**/api/albert/dialogue',r=>r.fulfill({json:{status:'ok',message:fixture.albert.turns[2].reply}}));
  // Never follow a local test capability into the public Telegram bot.
  await context.route('https://t.me/**',r=>r.abort());
  const shot=async(name:string)=>{
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:path.join('output/playwright',`${info.project.name}-${name}.png`),animations:'disabled'});
  };
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Продолжить к зеркалам'})).toBeDisabled();
  await shot('consent');
  for(const route of ['/privacy','/terms']){
    const r=await page.request.get(route);expect(r.status()).toBe(200);
    expect(await r.text()).not.toContain('<div id="root">');
  }
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Продолжить к зеркалам'}).click();
  await page.getByRole('heading',{name:'Зеркало себя',exact:true}).waitFor();await shot('landing');
  const [day,month,year]=persona.dob.split('.');
  await page.getByPlaceholder('ДД',{exact:true}).fill(day);
  await page.getByPlaceholder('ММ',{exact:true}).fill(month);
  await page.getByPlaceholder('ГГГГ',{exact:true}).fill(year);
  const calculation=page.waitForResponse(r=>r.url().endsWith('/api/calculate'));
  await page.getByRole('button',{name:'Рассчитать код',exact:true}).click();
  expect((await calculation).status()).toBe(200);
  await page.getByRole('button',{name:'Перейти к Личному мифу'}).waitFor();
  await page.evaluate(()=>scrollTo(0,0));await shot('code');
  await page.getByRole('button',{name:'Перейти к Личному мифу'}).click();
  await page.getByRole('button',{name:'Войти через образы',exact:true}).click();
  const tags=['01 / 04 · Напряжение','02 / 04 · Образ состояния','03 / 04 · Точка живости','04 / 04 · Искомое качество'];
  for(const [i,answer]of Object.values(persona.answers).entries()){
    await page.getByText(tags[i],{exact:true}).waitFor();
    await page.locator('textarea').fill(answer);
    await page.getByRole('button',{name:i===3?'Соткать историю':'Далее',exact:true}).click();
  }
  await page.locator('article').waitFor();await page.locator('article').scrollIntoViewIfNeeded();await shot('myth');
  expect(await page.locator('article p').first().evaluate(el=>Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
  await page.getByRole('button',{name:'Открыть Встречу зеркал',exact:true}).click();
  await page.getByRole('button',{name:'Провести Встречу зеркал',exact:true}).click();
  await page.getByRole('button',{name:'Диалог на сайте',exact:true}).waitFor();
  await shot('meeting');
  const telegram=page.getByRole('button',{name:'Продолжить в Telegram',exact:true});
  await expect(telegram).toBeDisabled();
  await page.getByRole('button',{name:'Диалог на сайте',exact:true}).click();
  await page.getByPlaceholder('Задайте вопрос Альберту о вашей карте и встрече зеркал...').fill(persona.request);
  await page.getByPlaceholder('Задайте вопрос Альберту о вашей карте и встрече зеркал...').press('Enter');
  await expect(page.getByText(fixture.albert.turns[2].reply,{exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCSS('opacity','1');
  await shot('albert');
  await page.getByRole('button',{name:'Закрыть диалог'}).click();
  await page.getByRole('button',{name:'Сохранить на этом устройстве',exact:true}).click();
  await expect(page.getByText('Сохранено в этом браузере',{exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Открыть сохранённое',exact:true}).click();
  await expect(page.getByRole('button',{name:'Диалог на сайте',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Продолжить в Telegram',exact:true})).toBeDisabled();
  await page.getByRole('checkbox').check();
  const claim=page.waitForResponse(r=>r.url().endsWith('/api/handoff/create-claim'));
  await page.getByRole('button',{name:'Продолжить в Telegram',exact:true}).click();
  const response=await claim;expect(response.status()).toBe(200);
  const payload=await response.json();
  const start=new URL(payload.telegramUrl).searchParams.get('start')!;
  expect(start).toMatch(/^h_[A-Za-z0-9_-]{43}$/);expect(start.length).toBeLessThanOrEqual(64);
  expect(payload.telegramUrl).not.toContain(persona.dob);
  expect(errors).toEqual([]);
});
