const fs = require('fs');
const path = require('path');

const corpusInputs = [
  // Category A: Daily Life & Concrete Objects (1-10)
  { id: 'case_01', cat: 'concrete', q1: 'усталость от бесконечной рутины и дедлайнов', q2: 'старый дубовый стол у окна с глубокими царапинами', q3: 'шум осеннего дождя за стеклом', q4: 'спокойная сосредоточенность' },
  { id: 'case_02', cat: 'concrete', q1: 'поиск своего истинного дела и призвания', q2: 'ржавый компас со сломанной стрелкой', q3: 'ветер на вершине песчаного холма', q4: 'решимость сделать первый шаг' },
  { id: 'case_03', cat: 'concrete', q1: 'желание контролировать каждую мелочь', q2: 'тяжелый медный ключ от запертой двери', q3: 'скрип старых половиц в темноте', q4: 'умение отпускать хватку' },
  { id: 'case_04', cat: 'concrete', q1: 'страх остаться незамеченным и потерянным', q2: 'маленький карманный фонарик в темноте', q3: 'ночная трасса в свете далеких фар', q4: 'внутреннее достоинство и свет' },
  { id: 'case_05', cat: 'concrete', q1: 'разрыв между задуманным планом и действием', q2: 'песочные часы с белым кварцевым песком', q3: 'звон колокола вдалеке', q4: 'точность и последовательность' },
  { id: 'case_06', cat: 'concrete', q1: 'давление чужих ожиданий и оценок', q2: 'старинное зеркало в резной чугунной раме', q3: 'гул вечернего метро', q4: 'верность своему выбору' },
  { id: 'case_07', cat: 'concrete', q1: 'напряжение перед важным решением', q2: 'шахматная доска с незаконченной партией', q3: 'тихий треск свечи на столе', q4: 'ясность ума и взвешенность' },
  { id: 'case_08', cat: 'concrete', q1: 'чувство разобщенности с коллегами', q2: 'глиняная кружка ручной работы с горячим чаем', q3: 'пар над водой в прохладном воздухе', q4: 'теплота и открытость' },
  { id: 'case_09', cat: 'concrete', q1: 'постоянная спешка и суета', q2: 'механический секундомер на кожаном ремешке', q3: 'ровный стук колес поезда', q4: 'размеренное спокойствие' },
  { id: 'case_10', cat: 'concrete', q1: 'необходимость защитить свои границы', q2: 'каменная ограда вокруг яблоневого сада', q3: 'шорох сухих трав на ветру', q4: 'твердость без агрессии' },

  // Category B: Nature, Landscape & Weather (11-20)
  { id: 'case_11', cat: 'nature', q1: 'поиск внутреннего покоя и тишины', q2: 'белая сова на заснеженной ветке сосны', q3: 'первый снег в вечерних сумерках', q4: 'глубокая созерцательная тишина' },
  { id: 'case_12', cat: 'nature', q1: 'борьба со скрытым сомнением', q2: 'черная скала посреди бурного морского прибоя', q3: 'соленый ветер и холодные брызги', q4: 'несгибаемая стойкость' },
  { id: 'case_13', cat: 'nature', q1: 'переход на новый жизненный рубеж', q2: 'перелетная птица высоко над осенней степью', q3: 'рассветное марево над гладкой рекой', q4: 'легкость и готовность к полету' },
  { id: 'case_14', cat: 'nature', q1: 'ощущение творческого застоя', q2: 'зеленый росток сквозь трещину в старом асфальте', q3: 'запах влажной земли после первой грозы', q4: 'живая сила весеннего обновления' },
  { id: 'case_15', cat: 'nature', q1: 'потеря внутреннего ориентира', q2: 'маяк на скалистом мысе среди тумана', q3: 'глухой рокот прибоя о камни', q4: 'непоколебимый луч света' },
  { id: 'case_16', cat: 'nature', q1: 'перегруженность информацией и шумом', q2: 'горное озеро с кристально прозрачной водой', q3: 'прохладный высокогорный воздух', q4: 'кристальная ясность' },
  { id: 'case_17', cat: 'nature', q1: 'страх неопределенности будущего', q2: 'узкая лесная тропа среди вековых сосен', q3: 'шорох хвои под ногами в тишине', q4: 'доверие каждому следующему шагу' },
  { id: 'case_18', cat: 'nature', q1: 'внутренний скрытый гнев', q2: 'дремлющий вулкан под снежной шапкой', q3: 'запах серы и горячего камня', q4: 'укрощенная созидательная мощь' },
  { id: 'case_19', cat: 'nature', q1: 'тоска по настоящей глубине отношений', q2: 'древнее дерево с раскидистой кроной и глубокими корнями', q3: 'шелест дубовых листьев в полдень', q4: 'укорененность и верность' },
  { id: 'case_20', cat: 'nature', q1: 'желание внутренней трансформации', q2: 'змеиный след на чистом песчаном бархане', q3: 'знойный сухой ветер пустыни', q4: 'мудрая способность сбрасывать старое' },

  // Category C: Psychological States, Ambiguity & Tension (21-28)
  { id: 'case_21', cat: 'psychological', q1: 'разорванность между долгом перед другими и собственным желанием', q2: 'весы с двумя чашами из темной бронзы', q3: 'тишина пустой библиотеки', q4: 'честное согласие с собой' },
  { id: 'case_22', cat: 'psychological', q1: 'чувство самозванца при новых достижениях', q2: 'театральная маска из папье-маше на гримерном столике', q3: 'приглушенный шум аплодисментов за кулисами', q4: 'принятие своей настоящей силы' },
  { id: 'case_23', cat: 'psychological', q1: 'страх эмоциональной близости и уязвимости', q2: 'хрустальная шкатулка с тонким замком', q3: 'звонкий звук падающей капли воды', q4: 'смелость открыться' },
  { id: 'case_24', cat: 'psychological', q1: 'стремление к недостижимому идеалу во всем', q2: 'неограненный алмаз в бархатном футляре', q3: 'скрип резца скульптора по мрамору', q4: 'любовь к живому несовершенству' },
  { id: 'case_25', cat: 'psychological', q1: 'сопротивление неизбежным переменам', q2: 'старый деревянный мост через бурную весеннюю реку', q3: 'треск ломающегося речного льда', q4: 'готовность перейти на другой берег' },
  { id: 'case_26', cat: 'psychological', q1: 'выгорание от чрезмерной ответственности', q2: 'потухший очаг с теплыми углями', q3: 'тихий треск остывающего камня', q4: 'право на отдых и тишину' },
  { id: 'case_27', cat: 'psychological', q1: 'постоянный внутренний критик и сомнения', q2: 'строгий гранитный барельеф судьи', q3: 'эхо шагов в пустом каменном зале', q4: 'сострадание к собственным ошибкам' },
  { id: 'case_28', cat: 'psychological', q1: 'потеря чувства времени и присутствия', q2: 'солнечные часы во внутреннем дворике монастыря', q3: 'полуденное стрекотание цикад', q4: 'полное пребывание в настоящем моменте' },

  // Category D: Terse / Minimal Inputs (29-33)
  { id: 'case_29', cat: 'terse', q1: 'поиск дома', q2: 'каменный очаг', q3: 'ночь', q4: 'тепло' },
  { id: 'case_30', cat: 'terse', q1: 'выбор пути', q2: 'развилка дорог', q3: 'ветер', q4: 'решимость' },
  { id: 'case_31', cat: 'terse', q1: 'усталость', q2: 'деревянная лодка', q3: 'тишина', q4: 'покой' },
  { id: 'case_32', cat: 'terse', q1: 'страх', q2: 'ключ', q3: 'темнота', q4: 'свет' },
  { id: 'case_33', cat: 'terse', q1: 'смысл', q2: 'книга', q3: 'дождь', q4: 'мудрость' },

  // Category E: Verbose / Rich Inputs (34-38)
  { 
    id: 'case_34', 
    cat: 'verbose', 
    q1: 'Постоянное гнетущее ощущение, что я должен оправдывать чужие высокие ожидания и не имею права показать слабость перед близкими людьми',
    q2: 'Тяжелый чугунный якорь, лежащий на песчаном берегу далеко от линии воды и покрытый тонким белым налетом морской соли',
    q3: 'Звук медленных шагов по мелкому гравию в абсолютной безветренной тишине старого осеннего липового парка',
    q4: 'Спокойная внутренняя автономия и твердое понимание собственной меры ответственности без вины'
  },
  { 
    id: 'case_35', 
    cat: 'verbose', 
    q1: 'Сложный экзистенциальный выбор между финансовой безопасностью на стабильной работе и рискованным творческим стартапом',
    q2: 'Архитектурный чертеж готического собора, на котором поверх черной туши случайно легли яркие брызги ультрамариновой акварели',
    q3: 'Запах старой типографской бумаги, свежей типографской краски и свежесваренного терпкого черного кофе в мастерской',
    q4: 'Гармоничный синтез строгой дисциплины и живого свободного вдохновения'
  },
  { 
    id: 'case_36', 
    cat: 'verbose', 
    q1: 'Ощущение глубокого одиночества в большой толпе людей и невозможности найти человека, который действительно понимает без слов',
    q2: 'Одинокий телескоп на деревянной террасе обсерватории, направленный в ночное созвездие Ориона',
    q3: 'Легкий ночной холод, касающийся кожи, и бескрайнее звездное небо без единого облака',
    q4: 'Глубокое доверие миру и осознание, что истинная связь не требует постоянных доказательств'
  },
  { 
    id: 'case_37', 
    cat: 'verbose', 
    q1: 'Мучительное желание контролировать результаты всех своих проектов и невозможность делегировать даже простые задачи сотрудникам',
    q2: 'Сложный часовой механизм с десятками бронзовых шестеренок, работающий под тонким хрустальным колпаком',
    q3: 'Мерное тихое тиканье маятника в абсолютно пустой комнате ранним утром',
    q4: 'Мудрая способность доверять другим людям и позволять жизни развиваться естественным путем'
  },
  { 
    id: 'case_38', 
    cat: 'verbose', 
    q1: 'Переживание кризиса среднего возраста и переоценка всех ранее достигнутых материальных целей и статусов',
    q2: 'Потрепанный кожаный походный рюкзак с медными пряжками, повидавший множество горных перевалов',
    q3: 'Шум горного водопада и запах прелой сосновой хвои на рассвете в горах',
    q4: 'Осознание истинной ценности простого человеческого опыта превыше любых внешних наград'
  },

  // Category F: Metaphors & Symbolic Punctuation (39-42)
  { id: 'case_39', cat: 'symbolic', q1: 'поиск баланса... (жизнь/работа)', q2: 'стеклянный калейдоскоп с цветными стеклышками', q3: 'дождь за окном — тихий, долгий и ровный', q4: 'внутренний дзен и спокойная улыбка' },
  { id: 'case_40', cat: 'symbolic', q1: 'вечный вопрос: «кто я на самом деле?»', q2: 'старый парусник на мели среди белого песка', q3: 'туман над утренним озером', q4: 'простое присутствие здесь и сейчас' },
  { id: 'case_41', cat: 'symbolic', q1: 'тяга к неизведанным горизонтам и тайнам', q2: 'карта звездного неба на пожелтевшем пергаменте', q3: 'ночной шелест прибоя о гальку', q4: 'тихий восторг первооткрывателя' },
  { id: 'case_42', cat: 'symbolic', q1: 'необходимость распутать сложный жизненный узел', q2: 'клубок золотой нити в деревянной чаше', q3: 'сквозняк в длинном каменном коридоре', q4: 'терпение и плавность движений' }
];

async function main() {
  const { DeepSeekClient } = await import('../server/deepseek.ts');
  const { 
    buildPersonalMythPromptV11, 
    parsePersonalMythRequest, 
    parsePersonalMythResult, 
    validatePersonalMythResult 
  } = await import('../server/myth.ts');

  const client = new DeepSeekClient(process.env);
  if (!client.isReady()) {
    console.error('DeepSeek client is not ready. Check DEEPSEEK_API_KEY.');
    process.exit(1);
  }

  console.log(`=============================================================`);
  console.log(`=== RUNNING 42 REAL MYTH GENERATION STRESS CASES VIA DEEPSEEK ===`);
  console.log(`=== MODEL: ${client.defaultModel} ===`);
  console.log(`=============================================================\n`);

  const results = [];
  let registerDefectCount = 0;
  let unicodeDefectCount = 0;
  let wordCountDefectCount = 0;
  let totalClichesCount = 0;
  let repairCountTotal = 0;

  for (let i = 0; i < corpusInputs.length; i++) {
    const item = corpusInputs[i];
    const requestId = `v1_1_stress_${item.id}_${Date.now()}`;
    const startTime = Date.now();

    console.log(`[${i + 1}/${corpusInputs.length}] Generating ${item.id} (${item.cat}): "${item.q1.slice(0, 35)}..."`);

    try {
      const parsedReq = parsePersonalMythRequest({
        request_id: requestId,
        answers: {
          q1: item.q1,
          q2: item.q2,
          q3: item.q3,
          q4: item.q4
        }
      });

      const initialPrompt = buildPersonalMythPromptV11(parsedReq);
      let rawResponse = await client.call({
        messages: [{ role: 'user', content: initialPrompt }],
        model: client.defaultModel,
        temperature: 0.7,
        max_tokens: 3000,
        timeoutMs: 90000
      });

      let parsedResult = parsePersonalMythResult(rawResponse);
      let report = validatePersonalMythResult(parsedResult);
      let repairsUsed = 0;

      if (!report.passed) {
        repairsUsed = 1;
        repairCountTotal++;
        console.log(`  [Repair 1/1] Quality blockers detected: ${report.blockers.join(', ')}. Running repair prompt...`);
        const repairPrompt = buildPersonalMythPromptV11(parsedReq, report.blockers);
        rawResponse = await client.call({
          messages: [{ role: 'user', content: repairPrompt }],
          model: client.defaultModel,
          temperature: 0.6,
          max_tokens: 3000,
          timeoutMs: 90000
        });
        parsedResult = parsePersonalMythResult(rawResponse);
        report = validatePersonalMythResult(parsedResult);
      }

      const text = parsedResult.story;
      const words = text.split(/\s+/u).filter(Boolean);
      const wordCount = words.length;

      const hasReplacementChar = text.includes('\ufffd');
      const hasGarbledAscii = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text);

      const tyMatches = text.match(/\b(ты|тебя|тебе|тобой|тобою|твой|твоя|твоё|твое|твои|твоих|твоем|твоём|твоему|твоей|твою)\b/giu) || [];
      const vyMatches = text.match(/\b(вы|вас|вам|вами|ваш|ваша|ваше|ваши|ваших|вашем|вашему|вашей|вашу)\b/giu) || [];
      const tyCount = tyMatches.length;
      const vyCount = vyMatches.length;
      const registerDefect = vyCount > 0;

      const cliches = [];
      if (/впервые за долгое время/iu.test(text)) cliches.push('впервые_за_долгое_время');
      if (/не\s+[\w\s]+,\s+а\s+[\w\s]+/iu.test(text) && (text.match(/не\s+[\w\s]+,\s+а\s+[\w\s]+/giu) || []).length > 2) cliches.push('не_X_а_Y_overuse');
      if (/ритуал на \d+ минут/iu.test(text)) cliches.push('ритуал_минут');
      if (/вс[её] будет хорошо/iu.test(text)) cliches.push('все_будет_хорошо');

      if (registerDefect) registerDefectCount++;
      if (hasReplacementChar || hasGarbledAscii) unicodeDefectCount++;
      if (wordCount < 150 || wordCount > 1200) wordCountDefectCount++;
      if (cliches.length > 0) totalClichesCount += cliches.length;

      const latencyMs = Date.now() - startTime;
      console.log(`  ✓ Done (${latencyMs}ms): "${parsedResult.title}" | Words: ${wordCount} | Ты: ${tyCount}, Вы: ${vyCount} | Cliches: ${cliches.length} | Repairs: ${repairsUsed}`);

      results.push({
        id: item.id,
        category: item.cat,
        inputs: parsedReq.answers,
        latencyMs,
        repairsUsed,
        validationPassed: report.passed,
        validationBlockers: report.blockers,
        parsedResult: {
          title: parsedResult.title,
          storyPreview: parsedResult.story.slice(0, 200) + '...',
          fullStory: parsedResult.story,
          mirror: parsedResult.mirror,
          meaning: parsedResult.meaning,
          oneStep: parsedResult.one_step,
          journalQuestion: parsedResult.journal_question,
          disclaimer: parsedResult.disclaimer
        },
        auditMetrics: {
          wordCount,
          hasReplacementChar,
          hasGarbledAscii,
          tyCount,
          vyCount,
          registerDefect,
          cliches
        }
      });

    } catch (err) {
      console.error(`  ✗ Error in ${item.id}:`, err.message);
      results.push({
        id: item.id,
        category: item.cat,
        inputs: { q1: item.q1, q2: item.q2, q3: item.q3, q4: item.q4 },
        error: err.message
      });
    }

    // Brief delay
    await new Promise((r) => setTimeout(r, 600));
  }

  const summary = {
    totalTested: corpusInputs.length,
    successCount: results.filter((r) => !r.error).length,
    repairCountTotal,
    registerDefectCount,
    registerDefectPercent: `${((registerDefectCount / results.length) * 100).toFixed(1)}%`,
    unicodeDefectCount,
    wordCountDefectCount,
    totalClichesCount,
    totalDefectRate: `${(((registerDefectCount + unicodeDefectCount + wordCountDefectCount) / results.length) * 100).toFixed(1)}%`,
    results
  };

  const outPath = '/tmp/myth_real_corpus_42_results.json';
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log(`\n=============================================================`);
  console.log(`=== 42 REAL MYTH STRESS CORPUS AUDIT COMPLETE ===`);
  console.log(`Total Tested: ${summary.totalTested}`);
  console.log(`Success: ${summary.successCount}`);
  console.log(`Repairs Triggered: ${repairCountTotal}`);
  console.log(`Register Defects ('вы' found in Myth): ${registerDefectCount} (${summary.registerDefectPercent})`);
  console.log(`Unicode / Mojibake Defects: ${unicodeDefectCount}`);
  console.log(`Word Count Out of Bounds: ${wordCountDefectCount}`);
  console.log(`Total Cliches Count: ${totalClichesCount}`);
  console.log(`Overall Defect Rate: ${summary.totalDefectRate}`);
  console.log(`Saved results to: ${outPath}`);
  console.log(`=============================================================\n`);
}

main().catch(console.error);
