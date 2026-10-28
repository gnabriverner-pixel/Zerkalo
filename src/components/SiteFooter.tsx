import React from 'react';

/** Contact placeholder: the owner fills it in before publication (see release-14 notes). */
export const CONTACT_PLACEHOLDER = '[e-mail для обращений]';

export function SiteFooter() {
  return (
    <footer data-site-footer className="relative z-10 px-4 py-8 text-center text-xs text-stone-400 border-t border-white/10 bg-[#090D15]">
      <nav aria-label="Документы и контакты" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        <a href="/terms" className="underline py-2 text-stone-300">Договор-оферта</a>
        <a href="/privacy" className="underline py-2 text-stone-300">Политика конфиденциальности</a>
        <span className="py-2">Контакты: {CONTACT_PLACEHOLDER}</span>
      </nav>
    </footer>
  );
}
