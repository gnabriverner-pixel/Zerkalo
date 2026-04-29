# AI HANDOFF — START HERE

Актуально на: 2026-04-29

Этот файл — входная точка для любой новой модели, агента, Codex/Antigravity-сессии или человека, который подключается к проекту **«Цифровой Код / Zerkalo»**.

Главная цель: быстро восстановить контекст, не сломать production и продолжить работу по правильной стратегии.

---

## 1. Executive verdict

Проект находится в стадии **живого smoke-deploy MVP**.

Уже есть две связанные части:

1. **Telegram-бот «Цифровой Код»**
   - живёт на VPS Beget;
   - работает как production-сервис;
   - подключён к DeepSeek;
   - используется как канал общения, возврата, уведомлений и будущей доставки.

2. **Zerkalo web app**
   - GitHub repo: `gnabriverner-pixel/Zerkalo`;
   - задеплоен на VPS отдельным сервисом;
   - публичные режимы: `Архитектура Кода` и `Личный Миф`;
   - собирает заявки через `/api/lead`;
   - отправляет Telegram-уведомление владельцу;
   - имеет `/health`, `privacy.html`, deploy artifacts.

Главный продуктовый статус:

> **Большое исследование пока не автоматический PDF. Это ручная премиальная заявка.**

---

## 2. Current architecture

```text
Пользователь
  ↓
Zerkalo web app
  ├─ Архитектура Кода → Первое зеркало → заявка
  └─ Личный Миф → образное отражение → заявка
  ↓
/api/lead
  ├─ сохраняет leads.json
  └─ уведомляет владельца в Telegram
  ↓
ручная связь
  ↓
Большое исследование / Полное зеркало
```

Telegram-бот:

```text
/start
  ├─ расчёт/диалог внутри бота
  └─ кнопка «Открыть Зеркало»
```

---

## 3. Main strategic decision

Не объединять физически Zerkalo и Telegram-бот.

Правильная модель:

- **Zerkalo** = визуальный вход, первое впечатление, заявка.
- **Telegram-бот** = сопровождение, уведомления, диалог, доставка, возврат.
- **Notion** = штаб, канон, методология, roadmap.
- **GitHub** = код, prompts, docs, контроль версий.
- **VPS Beget** = production.

---

## 4. What is working now

### Zerkalo

- `App.tsx` оставляет в публичной навигации только:
  - Архитектура;
  - Личный Миф.
- `CodeArchitecture` даёт расчёт и Первое зеркало.
- `PersonalMyth` даёт образный вход и fallback без Gemini.
- `LeadModal` собирает заявку.
- `/api/lead` сохраняет лид и отправляет Telegram notification.
- `/health` работает.
- `privacy.html` добавлен.
- `DEPLOY.md`, `deploy/zerkalo.service`, `deploy/zerkalo.nginx.conf`, `.env.production.example` подготовлены.

### Telegram-бот

- Production service активен.
- DeepSeek подключён.
- `/start` содержит кнопку «Открыть Зеркало».
- Бот не должен быть сломан при дальнейших изменениях.

---

## 5. Current open PRs / branch status

Ключевые PR:

- PR #2 `predeploy-hardening` — privacy, README, consent copy.
- PR #3 `feat: add deploy artifacts and telegram lead notifications` — deploy artifacts + Telegram notification. PR #3 создан поверх predeploy-ветки и фактически включает ценные правки PR #2.

Рабочая ветка для новых handoff/docs:

- `docs/project-handoff-context`

Перед merge нужно проверить актуальность PR #3 и не потерять его изменения.

---

## 6. What NOT to do now

Не делать сейчас:

- оплату;
- Telegram Mini App SDK;
- initData;
- автоматический PDF;
- личный кабинет;
- полноценную БД;
- режим совместимости;
- массовую рекламу;
- физическое объединение бота и Zerkalo.

---

## 7. Next best sequence

### 48 часов

1. Проверить вручную `http://217.12.37.223`.
2. Проверить Telegram-уведомление о заявке.
3. Merge PR #3 после финального просмотра.
4. Подключить домен и HTTPS.
5. Обновить `ZERKALO_URL` в боте на HTTPS-домен.

### 7 дней

1. Дать ссылку 5–10 людям.
2. Смотреть: вводят ли дату, дочитывают ли, оставляют ли заявку.
3. Сделать 1–3 ручных «Больших исследования».
4. Зафиксировать цену теста: 2 900 / 4 900 / 7 900 ₽.

### 30 дней

1. Полуавтоматический шаблон Большого исследования.
2. Ручная оплата.
3. PDF-шаблон.
4. Delivery через Telegram.
5. Учёт лидов.
6. Аналитика конверсии.

---

## 8. Where to look next

- `docs/CURRENT_SYSTEM_STATE_2026-04-29.md`
- `docs/AGENT_WORKING_PROTOCOL.md`
- `docs/LAUNCH_STRATEGY_48H_7D_30D.md`
- `obsidian/000_START_HERE_CIFROVOY_KOD_ZERKALO.md`

---

## 9. Core operating principle

Не строить идеальную платформу.

Главная ближайшая задача:

> получить первые реальные заявки и первые ручные продажи Большого исследования.
