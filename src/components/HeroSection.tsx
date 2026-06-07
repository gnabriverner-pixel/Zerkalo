import React from 'react';
import { motion } from 'motion/react';

const scrollToCalculator = () => {
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
      className="relative w-full max-w-3xl mx-auto px-6 pt-28 pb-16 md:pt-36 md:pb-20 text-center"
    >
      {/* Eyebrow */}
      <p className="text-[0.65rem] tracking-[0.3em] uppercase text-[var(--color-antique-gold)] mb-6 font-sans">
        Цифровой Код
      </p>

      {/* Headline */}
      <h1 className="text-4xl md:text-6xl font-serif text-[var(--color-ink)] leading-tight tracking-tight mb-8">
        Ваш личный код<br />
        <span className="gold-shimmer-text">по дате рождения</span>
      </h1>

      {/* Subtitle */}
      <p className="text-base md:text-lg font-sans text-[var(--color-graphite)] leading-relaxed max-w-xl mx-auto mb-12">
        Характер, путь, конфликт и деньги —<br />
        в одной карте без гаданий и эзотерики.
      </p>

      {/* CTA */}
      <motion.button
        whileHover={{ scale: 1.03, boxShadow: '0 0 20px rgba(200, 164, 93, 0.25)' }}
        whileTap={{ scale: 0.97 }}
        onClick={scrollToCalculator}
        className="px-10 py-4 bg-[var(--color-ink)] text-[var(--color-ivory)] font-sans text-[0.7rem] tracking-[0.3em] uppercase hover:bg-black transition-all border border-transparent hover:border-[var(--color-antique-gold)] duration-300"
      >
        Узнать свой код
      </motion.button>
    </motion.section>
  );
}
