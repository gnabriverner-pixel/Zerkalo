import React, { useEffect } from 'react';
import { MythV2AResultBody } from './MythV2AResult';
import { SiteFooter } from './SiteFooter';
import { MYTH_EXAMPLE_INPUTS, MYTH_EXAMPLE_RESULT } from '../data/mythExampleRelationship';

export const MYTH_EXAMPLE_PATH = '/primer-lichnogo-mifa';
export const isMythExamplePath = (pathname: string) => pathname.replace(/\/+$/, '') === MYTH_EXAMPLE_PATH;

/**
 * Public example of a Personal Myth (mode A) for a fictional person. Same screen as the real Myth result;
 * makes no requests and asks for no consent (nothing about the visitor is processed here).
 */
export function MythExamplePage() {
  useEffect(() => {
    document.title = 'Пример Личного мифа · Зеркало себя';
  }, []);
  return (
    <div className="min-h-screen bg-[#0b0d14] text-stone-100 flex flex-col">
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-12" data-testid="myth-example">
        <a href="/" className="inline-block text-[13px] uppercase tracking-[0.15em] text-[var(--color-antique-gold)] hover:underline">← На главную</a>
        <p data-testid="myth-example-banner" className="text-sm text-stone-300 font-serif italic text-center max-w-[var(--measure)] mx-auto">
          Пример для вымышленного человека. Ответы и история придуманы, чтобы показать, как выглядит Личный миф.
        </p>
        <MythV2AResultBody result={MYTH_EXAMPLE_RESULT} inputs={MYTH_EXAMPLE_INPUTS} />
        <div className="text-center">
          <a
            href="/?mode=myth"
            data-testid="myth-example-cta"
            className="inline-block px-8 py-4 bg-[var(--color-antique-gold)] text-gray-950 uppercase tracking-[0.18em] text-xs sm:text-sm font-semibold rounded-xs hover:bg-[#D9B770]"
          >
            Начать Личный миф
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
