import React, { useEffect, useState } from 'react';

/** Shown until the server publishes the operator e-mail (OPERATOR_EMAIL); no bracketed placeholders on the site. */
export const CONTACT_NEUTRAL = 'обращения — через форму поддержки';

interface LegalContact { email: string | null; support_url: string | null }

function useLegalContact(): LegalContact | null {
  const [contact, setContact] = useState<LegalContact | null>(null);
  useEffect(() => {
    let alive = true;
    try {
      fetch('/api/personal-myth/config', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(c => {
          const l = c?.legal_contact;
          if (alive && l && typeof l === 'object') {
            setContact({ email: typeof l.email === 'string' ? l.email : null, support_url: typeof l.support_url === 'string' ? l.support_url : null });
          }
        })
        .catch(() => { /* neutral text */ });
    } catch { /* neutral text */ }
    return () => { alive = false; };
  }, []);
  return contact;
}

export function SiteFooter() {
  const contact = useLegalContact();
  return (
    <footer data-site-footer className="relative z-10 px-4 py-8 text-center text-xs text-stone-400 border-t border-white/10 bg-[#090D15]">
      <nav aria-label="Документы и контакты" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        <a href="/terms" className="underline py-2 text-stone-300">Договор-оферта</a>
        <a href="/privacy" className="underline py-2 text-stone-300">Политика конфиденциальности</a>
        <span className="py-2">
          Контакты:{' '}
          {contact?.email
            ? <a href={`mailto:${contact.email}`} className="underline text-stone-300">{contact.email}</a>
            : contact?.support_url
              ? <a href={contact.support_url} rel="noopener" className="underline text-stone-300">форма поддержки</a>
              : CONTACT_NEUTRAL}
        </span>
      </nav>
    </footer>
  );
}
