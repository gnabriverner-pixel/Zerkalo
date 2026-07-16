import React from 'react';
import { ArrowUpRight, BookOpen, Eye, Scale } from 'lucide-react';
import { trackProductEvent } from '../lib/productAnalytics';

const TELEGRAM_URL = 'https://t.me/digitalcodesystem_bot';

const methodSteps = [
  {
    number: '01',
    title: 'Связанная формула',
    text: 'Пять позиций отвечают за разные стороны опыта: внутренний мотив, проявление, способ действия, направление реализации и зрелый результат.',
  },
  {
    number: '02',
    title: 'Составные маршруты',
    text: '35/8 читается не как общая «восьмёрка», а как движение 3 → 5 → 8: понять и собрать знание, перевести его для людей, затем закрепить в системе.',
  },
  {
    number: '03',
    title: 'Контекст человека',
    text: 'Дата задаёт рабочую гипотезу. Живая ситуация и три коротких ответа помогают понять, какой участок формулы сейчас действительно важен.',
  },
];

export function ProductTrustLayer() {
  return (
    <section aria-label="О методе Цифрового Кода" className="w-full border-t border-[var(--border-soft)] bg-[var(--color-ivory)]">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 md:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] md:px-10 md:py-28">
        <div>
          <p className="mb-5 text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-antique-gold)]">
            Авторский подход
          </p>
          <h2 className="max-w-3xl font-serif text-4xl leading-tight text-[var(--color-ink)] md:text-6xl">
            Дата не даёт готового ответа. Она задаёт карту для разговора.
          </h2>
          <p className="mt-8 max-w-2xl text-base leading-8 text-[var(--color-graphite)] md:text-lg">
            «Цифровой Код» — система самонаблюдения. Она соединяет традиционные символические трактовки чисел, пять позиций одной формулы и современную контекстную калибровку. Выводы остаются гипотезами, которые важно проверять на собственном опыте.
          </p>
        </div>

        <div className="border-l border-[var(--color-antique-gold)] pl-6 md:pl-9">
          <BookOpen className="mb-6 h-6 w-6 text-[var(--color-aegean)]" aria-hidden="true" />
          <h3 className="font-serif text-2xl text-[var(--color-ink)]">Откуда берётся рекомендация</h3>
          <p className="mt-4 leading-7 text-[var(--color-muted)]">
            В разборе должно быть видно, какая позиция или составной маршрут поддерживает вывод и какой ответ пользователя уточнил его. Совет без такого основания считается слабым.
          </p>
        </div>
      </div>

      <div className="w-full bg-[var(--color-aegean)] text-white">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-24">
          <p className="mb-10 text-[0.65rem] uppercase tracking-[0.22em] text-[#D8B870]">Как читается формула</p>
          <div className="divide-y divide-white/20 border-y border-white/20">
            {methodSteps.map((step) => (
              <div key={step.number} className="grid gap-4 py-8 md:grid-cols-[72px_240px_1fr] md:items-start">
                <span className="font-serif text-2xl text-[#D8B870]">{step.number}</span>
                <h3 className="font-serif text-2xl text-white">{step.title}</h3>
                <p className="max-w-2xl leading-7 text-white/75">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 md:grid-cols-[320px_1fr] md:px-10 md:py-28">
        <div className="relative min-h-[360px] overflow-hidden bg-[var(--color-ink)]">
          <img
            src="/albert-guide.png"
            alt="Редакционный образ цифрового проводника Альберта"
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        </div>
        <div className="self-center">
          <p className="mb-5 text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-olive)]">Кто говорит с вами</p>
          <h2 className="font-serif text-4xl text-[var(--color-ink)] md:text-5xl">Альберт — цифровой проводник</h2>
          <p className="mt-7 max-w-2xl text-base leading-8 text-[var(--color-graphite)] md:text-lg">
            Это редакционный образ, а не вымышленный психолог и не живой эксперт по ту сторону чата. Расчёт выполняется программно. Альберт помогает спокойно провести человека от формулы к вопросу, наблюдению и следующему шагу.
          </p>
          <p className="mt-5 max-w-2xl leading-7 text-[var(--color-muted)]">
            Система не ставит диагнозов, не предсказывает события и не подменяет профессиональную помощь. Её ценность — в точном языке для саморефлексии и в проверяемом практическом действии.
          </p>
        </div>
      </div>

      <div className="w-full border-y border-[var(--border-soft)] bg-[var(--color-warm-paper)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-3 md:px-10 md:py-20">
          <div>
            <Eye className="mb-5 h-6 w-6 text-[var(--color-terracotta)]" aria-hidden="true" />
            <h3 className="font-serif text-2xl">Сначала — первое зеркало</h3>
            <p className="mt-3 leading-7 text-[var(--color-muted)]">Бесплатный паспорт показывает формулу, одну узнаваемую связку, её основание и короткую практику.</p>
          </div>
          <div>
            <BookOpen className="mb-5 h-6 w-6 text-[var(--color-aegean)]" aria-hidden="true" />
            <h3 className="font-serif text-2xl">Затем — один вопрос</h3>
            <p className="mt-3 leading-7 text-[var(--color-muted)]">Глубокий разбор связывает позиции и составные числа с конкретной ситуацией, а не пересказывает общие значения.</p>
          </div>
          <div>
            <Scale className="mb-5 h-6 w-6 text-[var(--color-olive)]" aria-hidden="true" />
            <h3 className="font-serif text-2xl">Финал — проверка опытом</h3>
            <p className="mt-3 leading-7 text-[var(--color-muted)]">После разбора можно по желанию взять один шаг на семь дней и проверить гипотезу по понятному критерию.</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-20 md:flex-row md:items-end md:justify-between md:px-10 md:py-24">
        <div>
          <p className="mb-4 text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-antique-gold)]">Продолжить в Telegram</p>
          <h2 className="max-w-2xl font-serif text-4xl leading-tight text-[var(--color-ink)] md:text-5xl">Возьмите один вопрос, который действительно требует ясности.</h2>
          <p className="mt-5 max-w-xl leading-7 text-[var(--color-muted)]">Сначала бот бесплатно соберёт Цифровой паспорт. Решение о глубоком разборе можно принять после знакомства с результатом.</p>
        </div>
        <div className="flex flex-col items-start gap-4 md:items-end">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackProductEvent('telegram_deep_cta_click', { source: 'product_trust_layer' })}
            className="inline-flex min-h-12 items-center gap-3 bg-[var(--color-ink)] px-7 py-4 text-sm font-medium text-white transition-colors hover:bg-[var(--color-aegean)]"
          >
            Разобрать мой вопрос
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href="/privacy.html"
            onClick={() => trackProductEvent('privacy_link_click', { source: 'product_trust_layer' })}
            className="text-sm text-[var(--color-muted)] underline decoration-[var(--color-antique-gold)] underline-offset-4"
          >
            Как обрабатываются данные
          </a>
        </div>
      </div>
    </section>
  );
}
