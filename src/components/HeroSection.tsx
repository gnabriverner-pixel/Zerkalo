import React from 'react';
import { motion } from 'motion/react';
import { trackProductEvent } from '../lib/productAnalytics';

const scrollToCalculator = () => {
  trackProductEvent('hero_primary_cta_click', { destination: 'first_mirror' });
  const el = document.getElementById('calculator-start');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

export default function HeroSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="relative w-full max-w-4xl mx-auto px-6 pt-28 pb-16 md:pt-36 md:pb-20 text-center"
    >
      <p className="text-[0.65rem] tracking-[0.3em] uppercase text-[var(--color-antique-gold)] mb-6 font-sans">
        Зеркало себя · Цифровой Код
      </p>

      <h1 className="text-4xl md:text-6xl font-serif text-[var(--color-ink)] leading-tight tracking-tight mb-8">
        Сначала — узнавание.<br />
        <span className="gold-shimmer-text">Потом — ваш цифровой код.</span>
      </h1>

      <p className="text-base md:text-lg font-sans text-[var(--color-graphite)] leading-relaxed max-w-2xl mx-auto mb-5">
        Получите первое зеркало по дате рождения: что вас движет, как вы действуете, где возникает напряжение и куда ведёт ваш маршрут.
      </p>
      <p className="text-sm font-sans text-[var(--color-muted)] leading-relaxed max-w-xl mx-auto mb-12">
        Без гаданий и готовых приговоров. Сначала — узнаваемая гипотеза о вас, затем — формула, которая показывает, на чём она основана.
      </p>

      <motion.button
        whileHover={{ scale: 1.03, boxShadow: '0 0 20px rgba(200, 164, 93, 0.25)' }}
        whileTap={{ scale: 0.97 }}
        onClick={scrollToCalculator}
        className="px-10 py-4 bg-[var(--color-ink)] text-[var(--color-ivory)] font-sans text-[0.7rem] tracking-[0.3em] uppercase hover:bg-black transition-all border border-transparent hover:border-[var(--color-antique-gold)] duration-300"
      >
        Получить первое зеркало
      </motion.button>
      <p className="mt-4 text-xs tracking-[0.08em] text-[var(--color-muted)]">Бесплатный первый слой · без регистрации</p>
    </motion.section>
  );
}
