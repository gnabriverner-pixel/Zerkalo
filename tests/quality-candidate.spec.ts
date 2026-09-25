import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {personas} from '../scripts/quality/personas';

// UI/transport test with recorded synthetic MODEL outputs. Not a fresh model or Telegram delivery test.
const fixture=JSON.parse(fs.readFileSync('docs/evidence/quality-2026-09/final-18/synthetic_career.json','utf8'));
const meetingFixture=structuredClone(fixture.meeting);
meetingFixture.result.possibleSupport='Опорой может стать уже названное внимание к конкретной задаче; можно проверить его в одном небольшом действии.';
const persona=personas[0];
test('consent → canonical Code → recorded Myth/Meeting → save/reload → handoff',async({page,context},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(`${e.name}: ${e.message}`));
  const personalPosts:string[]=[];
  page.on('request',request=>{if(request.method()==='POST' && ['/api/code-v2','/api/calculate','/api/personal-myth','/api/meeting-of-mirrors','/api/lab/meeting/generate','/api/albert/dialogue'].some(path=>request.url().endsWith(path)))personalPosts.push(request.url());});
  const handoffPayloads:Record<string,unknown>[]=[];
  await page.addInitScript(()=>{
    (window as any).__telegramOpenedUrl='';
    (window as any).__handoffPayloads=[];
    window.open = ((..._args:any[])=>({
      closed:false,
      opener:null,
      location:{replace:(url:string)=>{(window as any).__telegramOpenedUrl=url;}},
      close:()=>undefined,
    })) as any;
    const realFetch=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      const requestUrl=new URL(typeof input==='string'?input:input instanceof URL?input.toString():input.url,location.href);
      if(requestUrl.pathname==='/api/handoff/create-claim'){
        (window as any).__handoffPayloads.push(JSON.parse(String(init?.body||'{}')));
        return new Response(JSON.stringify({status:'ok',claimId:'A'.repeat(43),token:'A'.repeat(43)+'.'+'B'.repeat(43),telegramUrl:`https://t.me/digitalcodesystem_bot?start=h_${'A'.repeat(43)}`,expiresAt:new Date(Date.now()+15*60_000).toISOString()}),{status:200,headers:{'Content-Type':'application/json'}});
      }
      return realFetch(input,init);
    };
  });
  await page.route('**/api/consent',async route=>{
    const request=route.request();
    if(request.method()==='POST' && request.postDataJSON()?.scope==='telegram_transfer'){
      await route.fulfill({json:{accepted:true,version:'zerkalo-2026-09-v1'}});
      return;
    }
    await route.continue();
  });
  await page.route('**/api/personal-myth',r=>r.fulfill({json:{mode:'story',status:'ok',story_result:fixture.myth.result}}));
  await page.route('**/api/meeting-of-mirrors',r=>r.fulfill({json:meetingFixture}));
  await page.route('**/api/albert/dialogue',r=>r.fulfill({json:{status:'ok',message:fixture.albert.turns[2].reply}}));
  // Never follow a synthetic test capability into the public Telegram bot.
  await context.route('https://t.me/**',r=>r.abort());
  const shot=async(name:string)=>{
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:path.join('output/playwright',`${info.project.name}-${name}.png`),animations:'disabled'});
  };
  await page.goto('/');
  await page.getByRole('heading',{name:'Зеркало себя',exact:true}).waitFor();await shot('landing');
  expect(personalPosts).toHaveLength(0);
  for(const route of ['/privacy','/terms']){
    const r=await page.request.get(route);expect(r.status()).toBe(200);
    expect(await r.text()).not.toContain('<div id="root">');
  }
  expect(page.viewportSize()).toEqual(info.project.use.viewport);
  const [day,month,year]=persona.dob.split('.');
  await page.getByPlaceholder('ДД',{exact:true}).fill(day);
  await page.getByPlaceholder('ММ',{exact:true}).fill(month);
  await page.getByPlaceholder('ГГГГ',{exact:true}).fill(year);
  await page.getByRole('button',{name:'Рассчитать код',exact:true}).click();
  await page.getByRole('button',{name:'Открыть мой Код',exact:true}).waitFor();
  expect(personalPosts).toHaveLength(0);
  await page.getByRole('button',{name:'Открыть мой Код',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Ваш опыт остаётся вашим'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Согласиться и продолжить'})).toBeDisabled();
  await shot('consent');
  await page.getByRole('button',{name:'Сейчас не хочу'}).click();
  expect(personalPosts).toHaveLength(0);
  await expect(page.getByPlaceholder('ГГГГ',{exact:true})).toHaveValue(year);
  await page.getByRole('button',{name:'Открыть мой Код',exact:true}).click();
  await page.getByRole('dialog',{name:'Ваш опыт остаётся вашим'}).getByRole('checkbox').check();
  const calculation=page.waitForResponse(r=>r.url().endsWith('/api/calculate') || r.url().endsWith('/api/code-v2'));
  await page.getByRole('button',{name:'Согласиться и продолжить'}).click();
  expect((await calculation).status()).toBe(200);
  await expect(page.getByRole('link',{name:'Открыть в Telegram',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Перейти к Личному мифу'}).waitFor();
  await page.evaluate(()=>scrollTo(0,0));await shot('code');
  await page.getByRole('button',{name:'Перейти к Личному мифу'}).click();
  await page.getByRole('button',{name:'Войти через образы',exact:true}).click();
  const tags=['01 / 04 · Ситуация','02 / 04 · Образ состояния','03 / 04 · Точка живости','04 / 04 · Искомое качество'];
  for(const [i,answer]of Object.values(persona.answers).entries()){
    await page.getByText(tags[i]).waitFor();
    await page.locator('textarea').fill(answer);
    await page.getByRole('button',{name:i===3?'Соткать историю':'Далее',exact:true}).click();
  }
  await page.locator('article').waitFor();await page.locator('article').scrollIntoViewIfNeeded();await shot('myth');
  expect(await page.locator('article p').first().evaluate(el=>Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
  await page.getByRole('button',{name:'Открыть Встречу зеркал',exact:true}).click();
  await page.getByRole('button',{name:'Провести Встречу зеркал',exact:true}).click();
  await page.getByRole('button',{name:'Диалог на сайте',exact:true}).waitFor();
  await expect(page.getByText('Возможная опора',{exact:true})).toBeVisible();
  expect(await page.getByText(meetingFixture.result.possibleSupport,{exact:true}).evaluate(el=>Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
  await shot('meeting');
  await page.getByRole('button',{name:'Продолжить в Telegram',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Продолжить исследование в Telegram?'})).toBeVisible();
  await expect(page.getByText(/Дата рождения и исходные ответы Мифа в эту передачу не входят/)).toBeVisible();
  await shot('handoff-consent');
  const transferConsent=page.getByRole('checkbox',{name:'Я согласен передать эту краткую сводку Альберту в Telegram.'});
  await expect(page.getByRole('button',{name:'Согласиться и открыть Telegram'})).toBeDisabled();
  await transferConsent.check();
  await page.getByRole('button',{name:'Согласиться и открыть Telegram'}).click();
  await expect(page.getByRole('status')).toContainText('Telegram открыт в новой вкладке');
  await expect(page.getByRole('status')).toBeInViewport();
  await shot('handoff-success');
  const transfer=await page.evaluate(()=> (window as any).__handoffPayloads[0]);
  handoffPayloads.push(transfer);
  expect(transfer).toHaveProperty('codeResult');
  expect(transfer).toHaveProperty('storyResult');
  expect(transfer).toHaveProperty('meetingResult');
  expect(transfer).not.toHaveProperty('dob');
  expect(transfer).not.toHaveProperty('storyInputs');
  expect(transfer).not.toHaveProperty('q1');
  expect(handoffPayloads).toHaveLength(1);
  expect(await page.evaluate(()=> (window as any).__telegramOpenedUrl)).toMatch(/^https:\/\/t\.me\/digitalcodesystem_bot\?start=h_[A-Za-z0-9_-]{43}$/);
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
  await page.getByRole('button',{name:'Продолжить с того места',exact:true}).click();
  await expect(page.getByRole('button',{name:'Диалог на сайте',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Продолжить в Telegram',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('direct Code link sanitizes ?dob= and prefilled date does not auto-send before explicit consent',async({page})=>{
  const sent:string[]=[];
  page.on('request',request=>{if(request.method()==='POST' && (request.url().endsWith('/api/code-v2') || request.url().endsWith('/api/calculate')))sent.push(request.url());});
  await page.goto('/?preview=v2&dob=06.05.1986');
  expect(page.url()).not.toContain('dob=');
  await expect(page.getByPlaceholder('ДД',{exact:true})).toHaveValue('');
  await expect(page.getByPlaceholder('ММ',{exact:true})).toHaveValue('');
  await expect(page.getByPlaceholder('ГГГГ',{exact:true})).toHaveValue('');
  await expect(page.getByRole('dialog',{name:'Ваш опыт остаётся вашим'})).toHaveCount(0);
  expect(sent).toHaveLength(0);

  await page.goto('/');
  await page.getByPlaceholder('ДД',{exact:true}).fill('06');
  await page.getByPlaceholder('ММ',{exact:true}).fill('05');
  await page.getByPlaceholder('ГГГГ',{exact:true}).fill('1986');
  await page.getByRole('button',{name:'Рассчитать код',exact:true}).click();
  await expect(page.getByPlaceholder('ДД',{exact:true})).toHaveValue('06');
  await expect(page.getByPlaceholder('ММ',{exact:true})).toHaveValue('05');
  await expect(page.getByPlaceholder('ГГГГ',{exact:true})).toHaveValue('1986');
  await expect(page.getByRole('dialog',{name:'Ваш опыт остаётся вашим'})).toHaveCount(0);
  expect(sent).toHaveLength(0);

  await page.evaluate(()=>{
    localStorage.setItem('zerkalo_transient_draft_v1',JSON.stringify({
      version:1,
      updatedAt:new Date().toISOString(),
      journeyId:'restored-test-journey',
      mode:'alabaster',
      codeDate:'06.05.1986',
      codeResult:null,
      firstMirror:null,
      codeV2Payload:null,
      storyInputs:{q1:'Тестовый черновик',q2:'',q3:'',q4:''},
      storyResult:null,
      meetingResult:null,
      meetingUserNote:'',
    }));
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await expect(page.getByPlaceholder('ДД',{exact:true})).toHaveValue('06');
  await expect(page.getByPlaceholder('ММ',{exact:true})).toHaveValue('05');
  await expect(page.getByPlaceholder('ГГГГ',{exact:true})).toHaveValue('1986');
  await expect(page.getByRole('dialog',{name:'Ваш опыт остаётся вашим'})).toHaveCount(0);
  expect(sent).toHaveLength(0);
});
