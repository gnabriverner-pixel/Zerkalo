import { zerkaloContent } from '../../content/zerkaloLandingContent';

export function PremiumHero() {
  const c = zerkaloContent.hero;
  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_35%,rgba(201,169,110,0.08)_0%,transparent_70%)]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] border border-[var(--color-antique-gold)]/10 rounded-full" />
      <div className="relative z-10 text-center px-4 max-w-[480px] mx-auto">
        <div className="font-serif text-5xl text-[var(--color-antique-gold)]/30 mb-6">◈</div>
        <div className="text-xs uppercase tracking-[0.25em] text-[var(--color-antique-gold)] mb-6">{c.eyebrow}</div>
        <h1 className="font-serif font-semibold text-[clamp(2.5rem,7vw,4rem)] leading-[1.12] mb-4 whitespace-pre-line">{c.headline}</h1>
        {c.subtitle.map((s, i) => (
          <p key={i} className="text-[var(--color-graphite)] text-[1.05rem] max-w-[340px] mx-auto mb-1">{s}</p>
        ))}
        <a href="#how" className="inline-flex items-center justify-center gap-2 px-9 py-[15px] bg-[var(--color-antique-gold)] text-[#0a0a0f] rounded-lg font-medium text-[0.95rem] mt-8 hover:bg-[var(--color-deep-gold)] hover:-translate-y-[1px] transition-all duration-200 hover:shadow-[0_8px_24px_rgba(201,169,110,0.2)] no-underline min-h-[50px]">
          {c.cta}
        </a>
        <p className="mt-10 text-xs text-[var(--color-muted)] max-w-[280px] mx-auto leading-relaxed relative before:block before:w-5 before:h-px before:bg-[var(--color-antique-gold)]/30 before:mx-auto before:mb-4 whitespace-pre-line">{c.disclaimer}</p>
      </div>
    </section>
  );
}

export function GoldLine() {
  return <div className="w-px h-10 bg-gradient-to-b from-transparent via-[var(--color-antique-gold)] to-transparent mx-auto opacity-50" />;
}

import { useState } from 'react';

export function HowItWorksSection() {
  const c = zerkaloContent.howItWorks;
  return (
    <section id="how" className="py-[clamp(3rem,10vw,7rem)]">
      <div className="max-w-[480px] mx-auto px-[clamp(1.25rem,5vw,2rem)]">
        <h2 className="font-serif font-semibold text-[clamp(1.75rem,4.5vw,2.5rem)] text-center mb-8">{c.title}</h2>
        <div className="flex flex-col gap-8 max-w-[360px] mx-auto">
          {c.steps.map((s, i) => (
            <div key={i} className="text-center">
              <div className="font-serif text-2xl text-[var(--color-antique-gold)]/50 mb-2">{i + 1}</div>
              <div className="text-[1rem] text-[var(--color-ivory)] mb-1">{s.title}</div>
              <div className="text-sm text-[var(--color-muted)] leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <a href="#start" className="inline-flex items-center justify-center px-9 py-[15px] bg-[var(--color-antique-gold)] text-[#0a0a0f] rounded-lg font-medium no-underline min-h-[50px]">{c.cta}</a>
        </div>
      </div>
    </section>
  );
}

export function BirthDateInputSection() {
  const c = zerkaloContent.dateInput;
  return (
    <section id="start" className="py-[clamp(3rem,10vw,7rem)]">
      <div className="max-w-[480px] mx-auto px-[clamp(1.25rem,5vw,2rem)] text-center">
        <h2 className="font-serif font-semibold text-[clamp(1.75rem,4.5vw,2.5rem)] mb-4">{c.title}</h2>
        <p className="text-[var(--color-muted)] mb-8 max-w-[280px] mx-auto">{c.subtitle}</p>
        <div className="max-w-[300px] mx-auto mb-6">
          <input type="date" className="w-full px-4 py-[13px] bg-[var(--color-warm-paper)] border border-[var(--color-bronze)] rounded-lg text-[var(--color-ivory)] text-[1.1rem] text-center min-h-[50px] focus:outline-none focus:border-[var(--color-antique-gold)] transition-colors" />
        </div>
        <a href="#insight" className="inline-flex items-center justify-center px-9 py-[15px] bg-[var(--color-antique-gold)] text-[#0a0a0f] rounded-lg font-medium no-underline min-h-[50px]">{c.cta}</a>
      </div>
    </section>
  );
}

export function MirrorAwakeningSection() {
  const c = zerkaloContent.mirrorAwakening;
  return (
    <section id="mirror" className="py-12">
      <div className="max-w-[480px] mx-auto px-[clamp(1.25rem,5vw,2rem)] text-center">
        <div className="w-16 h-16 border-[1.5px] border-[var(--color-antique-gold)] rounded-full mx-auto mb-8 opacity-50 animate-[mirrorPulse_3s_ease-in-out_infinite]" />
        <p className="text-[var(--color-muted)] text-sm">{c.text}</p>
      </div>
    </section>
  );
}

export function FreeInsightSection() {
  const c = zerkaloContent.freeInsight;
  return (
    <section id="insight" className="py-[clamp(3rem,10vw,7rem)]">
      <div className="max-w-[480px] mx-auto px-[clamp(1.25rem,5vw,2rem)]">
        <div className="bg-[var(--color-warm-paper)] border border-white/5 rounded-xl p-[clamp(2rem,5vw,3rem)] text-center relative before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-10 before:h-px before:bg-[var(--color-antique-gold)]/40">
          <div className="text-xs uppercase tracking-[0.15em] text-[var(--color-muted)] mb-5">{c.label}</div>
          <div className="font-serif text-[clamp(5rem,14vw,7rem)] text-[var(--color-antique-gold)] leading-none mb-1">{c.number}</div>
          <p className="text-[0.95rem] text-[var(--color-graphite)] max-w-[300px] mx-auto leading-relaxed">{c.text}</p>
          <div className="w-6 h-px bg-[var(--color-bronze)] mx-auto my-5" />
          <p className="text-xs text-[var(--color-muted)]">{c.footer}</p>
        </div>
        <div className="text-center mt-8">
          <a href="#premium" className="inline-flex items-center justify-center px-8 py-[14px] border border-[var(--color-antique-gold)]/30 text-[var(--color-antique-gold)] rounded-lg font-medium no-underline min-h-[50px] hover:bg-[var(--color-antique-gold)]/10">{c.cta}</a>
        </div>
      </div>
    </section>
  );
}

export function PremiumTeaserSection() {
  const c = zerkaloContent.premiumTeaser;
  return (
    <section id="premium" className="py-[clamp(3rem,10vw,7rem)]">
      <div className="max-w-[480px] mx-auto px-[clamp(1.25rem,5vw,2rem)]">
        <h2 className="font-serif font-semibold text-[clamp(1.75rem,4.5vw,2.5rem)] text-center mb-8">{c.title}</h2>
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2">
          {c.items.map((item, i) => (
            <div key={i} className="bg-[var(--color-warm-paper)] border border-white/5 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-[#08080d]/75 backdrop-blur-md" />
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-2 h-2 bg-[var(--color-antique-gold)] rounded-full flex-shrink-0 opacity-70" />
                <span className="text-sm text-[var(--color-ivory)]">{item}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <a href="#offer" className="inline-flex items-center justify-center px-9 py-[15px] bg-[var(--color-antique-gold)] text-[#0a0a0f] rounded-lg font-medium no-underline min-h-[50px]">{c.cta}</a>
        </div>
      </div>
    </section>
  );
}

export function BigResearchOfferSection() {
  const c = zerkaloContent.offer;
  return (
    <section id="offer" className="py-[clamp(3rem,10vw,7rem)]">
      <div className="max-w-[480px] mx-auto px-[clamp(1.25rem,5vw,2rem)]">
        <div className="bg-[var(--color-warm-paper)] border border-[var(--color-antique-gold)]/10 rounded-xl p-[clamp(2rem,5vw,3rem)] text-center relative">
          <h3 className="font-serif font-semibold text-[clamp(1.2rem,3vw,1.5rem)] mb-2">{c.title}</h3>
          <p className="text-[var(--color-muted)] text-sm">{c.subtitle}</p>
          <ul className="list-none text-left max-w-[300px] mx-auto my-6 flex flex-col gap-3">
            {c.items.map((item, i) => (
              <li key={i} className="text-sm text-[var(--color-graphite)] pl-6 relative leading-relaxed before:content-['—'] before:absolute before:left-0 before:text-[var(--color-antique-gold)]/60">{item}</li>
            ))}
          </ul>
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-[0.1em] mt-4">{c.priceLabel}</div>
          <div className="font-serif text-3xl text-[var(--color-antique-gold)] my-1">{c.price}</div>
          <a href="#request" className="inline-flex items-center justify-center px-9 py-[15px] bg-[var(--color-antique-gold)] text-[#0a0a0f] rounded-lg font-medium no-underline min-h-[50px] mt-4">{c.cta}</a>
        </div>
      </div>
    </section>
  );
}

export function TrustSection() {
  const c = zerkaloContent.trust;
  return (
    <section className="py-4">
      <div className="max-w-[480px] mx-auto px-[clamp(1.25rem,5vw,2rem)]">
        <div className="flex flex-col gap-4 max-w-[360px] mx-auto">
          {c.items.map((item, i) => (
            <div key={i} className="flex items-start gap-3 text-[0.8rem] text-[var(--color-muted)] leading-relaxed">
              <span className="text-[var(--color-antique-gold)]/50 flex-shrink-0 mt-0.5">◇</span>
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LeadFormSection() {
  const c = zerkaloContent.request;
  const [consent, setConsent] = useState(false);
  return (
    <section id="request" className="py-[clamp(3rem,10vw,7rem)]">
      <div className="max-w-[480px] mx-auto px-[clamp(1.25rem,5vw,2rem)]">
        <h2 className="font-serif font-semibold text-[clamp(1.75rem,4.5vw,2.5rem)] text-center mb-4">{c.title}</h2>
        <p className="text-[var(--color-muted)] text-center mb-8">{c.subtitle}</p>
        <div className="max-w-[360px] mx-auto">
          <div className="mb-4">
            <label className="block text-[0.7rem] text-[var(--color-muted)] uppercase tracking-[0.15em] mb-1.5">Имя</label>
            <input type="text" placeholder="Ваше имя" className="w-full px-4 py-[13px] bg-[var(--color-warm-paper)] border border-[var(--color-bronze)] rounded-lg text-[var(--color-ivory)] text-[0.95rem] min-h-[50px] focus:outline-none focus:border-[var(--color-antique-gold)] transition-colors" />
          </div>
          <div className="mb-4">
            <label className="block text-[0.7rem] text-[var(--color-muted)] uppercase tracking-[0.15em] mb-1.5">Дата рождения</label>
            <input type="date" className="w-full px-4 py-[13px] bg-[var(--color-warm-paper)] border border-[var(--color-bronze)] rounded-lg text-[var(--color-ivory)] text-[0.95rem] min-h-[50px] focus:outline-none focus:border-[var(--color-antique-gold)] transition-colors" />
          </div>
          <div className="mb-4">
            <label className="block text-[0.7rem] text-[var(--color-muted)] uppercase tracking-[0.15em] mb-1.5">Контакт</label>
            <input type="text" placeholder="Telegram или телефон" className="w-full px-4 py-[13px] bg-[var(--color-warm-paper)] border border-[var(--color-bronze)] rounded-lg text-[var(--color-ivory)] text-[0.95rem] min-h-[50px] focus:outline-none focus:border-[var(--color-antique-gold)] transition-colors" />
          </div>
          <div className="flex items-start gap-2 text-[0.7rem] text-[var(--color-muted)] my-5 leading-relaxed">
            <input type="checkbox" id="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[var(--color-antique-gold)]" />
            <label htmlFor="consent">{c.consent}</label>
          </div>
          <a href="#delivery" className="flex items-center justify-center w-full px-9 py-[15px] bg-[var(--color-antique-gold)] text-[#0a0a0f] rounded-lg font-medium no-underline min-h-[50px]">{c.cta}</a>
        </div>
      </div>
    </section>
  );
}

export function TelegramDeliverySection() {
  const c = zerkaloContent.delivery;
  return (
    <section id="delivery" className="py-[clamp(3rem,10vw,7rem)]">
      <div className="max-w-[480px] mx-auto px-[clamp(1.25rem,5vw,2rem)]">
        <div className="bg-[var(--color-warm-paper)] border border-white/5 rounded-xl p-10 text-center">
          <div className="text-4xl mb-5 opacity-60">◆</div>
          <h3 className="font-serif font-semibold text-[clamp(1.2rem,3vw,1.5rem)] mb-4">{c.title}</h3>
          <p className="text-[var(--color-graphite)]">{c.text}</p>
          <p className="text-[var(--color-muted)] text-sm mt-3">{c.subtext}</p>
          <a href="#" className="inline-flex items-center justify-center px-9 py-[15px] bg-[var(--color-antique-gold)] text-[#0a0a0f] rounded-lg font-medium no-underline min-h-[50px] mt-6">{c.cta}</a>
        </div>
      </div>
    </section>
  );
}

export function MobileBottomCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-[#08080d]/95 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
      <a href="#start" className="flex items-center justify-center w-full px-9 py-[15px] bg-[var(--color-antique-gold)] text-[#0a0a0f] rounded-lg font-medium no-underline min-h-[50px]">{zerkaloContent.hero.cta}</a>
    </div>
  );
}

/* Mirror pulse keyframe */
export const mirrorStyles = `
@keyframes mirrorPulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.03); }
}
`;
