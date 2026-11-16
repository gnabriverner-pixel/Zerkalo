import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import CodeArchitecture from './components/CodeArchitecture';
import PersonalMyth from './components/PersonalMyth';
import { MeetingOfMirrors } from './components/MeetingOfMirrors';
import { ModelComparisonHarness } from './components/ModelComparisonHarness';
import { LabEntryView } from './components/LabEntryView';
import { MetaphorLibrary } from './components/MetaphorLibrary';
import { AboutMethod } from './components/AboutMethod';
import { CalculationResult, FirstMirror, StoryInputs, ApiResponse } from './types';

export default function App() {
  const [mode, setMode] = useState<'entry' | 'code' | 'myth' | 'meeting' | 'ab-test'>('entry');
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Shared state between lenses
  const [codeDate, setCodeDate] = useState<string>('');
  const [codeResult, setCodeResult] = useState<CalculationResult | null>(null);
  const [firstMirror, setFirstMirror] = useState<FirstMirror | null>(null);
  const [storyInputs, setStoryInputs] = useState<StoryInputs | null>(null);
  const [storyResult, setStoryResult] = useState<ApiResponse['story_result'] | null>(null);

  const hasCode = !!codeResult;
  const hasMyth = !!storyResult;
  const hasBoth = hasCode && hasMyth;

  return (
    <div className="min-h-screen w-full flex flex-col font-sans bg-[#050914] text-[#F7F4ED] relative overflow-x-hidden selection:bg-[var(--color-antique-gold)]/20 selection:text-white">
      
      {/* ========================================================= */}
      {/* BREATHING COSMIC SKY & AURORA HORIZON                     */}
      {/* ========================================================= */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 cosmic-starfield opacity-65" />

        <div
          className="absolute -top-[25%] left-[8%] w-[70vw] h-[70vw] max-w-[950px] max-h-[950px] rounded-full animate-aurora"
          style={{
            background: 'radial-gradient(circle, rgba(124, 232, 238, 0.08) 0%, rgba(127, 156, 245, 0.06) 45%, transparent 72%)',
            filter: 'blur(75px)',
          }}
        />
        <div
          className="absolute top-[20%] -right-[18%] w-[65vw] h-[65vw] max-w-[880px] max-h-[880px] rounded-full animate-aurora"
          style={{
            background: 'radial-gradient(circle, rgba(223, 190, 120, 0.09) 0%, rgba(182, 157, 248, 0.05) 45%, transparent 72%)',
            filter: 'blur(85px)',
            animationDelay: '-10s',
          }}
        />
        <div
          className="absolute -bottom-[30%] left-[18%] w-[75vw] h-[75vw] max-w-[980px] max-h-[980px] rounded-full animate-aurora"
          style={{
            background: 'radial-gradient(circle, rgba(182, 157, 248, 0.07) 0%, rgba(124, 232, 238, 0.04) 48%, transparent 74%)',
            filter: 'blur(90px)',
            animationDelay: '-18s',
          }}
        />
      </div>

      {/* Weightless Celestial Header */}
      <header className="fixed top-0 left-0 w-full flex justify-between items-center z-50 py-5 px-6 sm:px-12 pointer-events-none bg-gradient-to-b from-[#050914]/90 via-[#050914]/50 to-transparent">
        
        {/* Left: Minimal Brand */}
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            onClick={() => setMode('entry')}
            className="group flex items-center gap-3 text-left transition-all duration-500 cursor-pointer"
            title="В открытое пространство"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--color-antique-gold)] shadow-[0_0_12px_rgba(223,190,120,0.8)] group-hover:scale-125 transition-transform" />
            <span className="font-serif text-xl tracking-wide text-[#F7F4ED] group-hover:text-[var(--color-antique-gold)] transition-colors">
              Зеркало себя
            </span>
          </button>
        </div>

        {/* Center: Airy Orbit Switcher */}
        <nav aria-label="Орбиты исследования" className="flex items-center gap-4 sm:gap-8 pointer-events-auto">
          
          <button
            onClick={() => setMode('myth')}
            className={`py-1 text-[11px] tracking-[0.22em] uppercase transition-all duration-300 flex items-center gap-2 cursor-pointer border-b ${
              mode === 'myth'
                ? 'border-[var(--color-antique-gold)] text-[var(--color-antique-gold)]'
                : 'border-transparent text-[#C6CFE0]/75 hover:text-white'
            }`}
          >
            <span>I · Личный Миф</span>
            {hasMyth && <span className="w-1.5 h-1.5 rounded-full bg-[#7CE8EE]" />}
          </button>

          <button
            onClick={() => setMode('code')}
            className={`py-1 text-[11px] tracking-[0.22em] uppercase transition-all duration-300 flex items-center gap-2 cursor-pointer border-b ${
              mode === 'code'
                ? 'border-[var(--color-antique-gold)] text-[var(--color-antique-gold)]'
                : 'border-transparent text-[#C6CFE0]/75 hover:text-white'
            }`}
          >
            <span>II · Космос Даты</span>
            {hasCode && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-antique-gold)]" />}
          </button>

          <button
            onClick={() => setMode('meeting')}
            className={`py-1 text-[11px] tracking-[0.22em] uppercase transition-all duration-300 flex items-center gap-2 cursor-pointer border-b ${
              mode === 'meeting'
                ? 'border-[var(--color-antique-gold)] text-[var(--color-antique-gold)]'
                : hasBoth
                  ? 'border-transparent text-[var(--color-antique-gold)] hover:text-white'
                  : 'border-transparent text-[#C6CFE0]/75 hover:text-white'
            }`}
          >
            <span>Встреча</span>
            {hasBoth && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />}
          </button>
        </nav>

        {/* Right: Quiet Knowledge Links */}
        <div className="pointer-events-auto flex items-center gap-6 text-xs text-[#C6CFE0]/75">
          <button
            onClick={() => setShowAbout(true)}
            className="hover:text-[var(--color-antique-gold)] tracking-[0.2em] uppercase text-[10px] transition-colors cursor-pointer font-light whitespace-nowrap"
          >
            Космология
          </button>

          <button
            onClick={() => setShowLibrary(true)}
            className="hover:text-[var(--color-antique-gold)] tracking-[0.2em] uppercase text-[10px] transition-colors hidden md:inline-block cursor-pointer font-light whitespace-nowrap"
          >
            Архетипы
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full flex-grow flex flex-col pt-20 relative z-10">
        <AnimatePresence mode="wait">
          
          {mode === 'entry' && (
            <motion.div
              key="entry"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <LabEntryView
                codeResult={codeResult}
                storyResult={storyResult}
                onOpenAbout={() => setShowAbout(true)}
                onSelectMode={(m, initialDate) => {
                  if (initialDate) setCodeDate(initialDate);
                  setMode(m);
                }}
              />
            </motion.div>
          )}

          {mode === 'code' && (
            <motion.div
              key="code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <CodeArchitecture 
                initialDate={codeDate}
                onOpenAbout={() => setShowAbout(true)} 
                onCodeCalculated={(calc, reading) => {
                  setCodeResult(calc);
                  if (reading) setFirstMirror(reading);
                }}
                onNavigateToMeeting={() => setMode('meeting')}
                hasMythResult={hasMyth}
              />
            </motion.div>
          )}

          {mode === 'myth' && (
            <motion.div
              key="myth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <PersonalMyth 
                onOpenAbout={() => setShowAbout(true)}
                onMythCompleted={(inputs, result) => {
                  setStoryInputs(inputs);
                  setStoryResult(result || null);
                }}
                onNavigateToMeeting={() => setMode(hasCode ? 'meeting' : 'code')}
                hasCodeResult={hasCode}
              />
            </motion.div>
          )}

          {mode === 'meeting' && (
            <motion.div
              key="meeting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <MeetingOfMirrors
                codeResult={codeResult}
                firstMirror={firstMirror}
                storyInputs={storyInputs}
                storyResult={storyResult}
                onOpenCode={() => setMode('code')}
                onOpenMyth={() => setMode('myth')}
              />
            </motion.div>
          )}

          {mode === 'ab-test' && (
            <motion.div
              key="ab-test"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <ModelComparisonHarness />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Global Modals */}
      <MetaphorLibrary isOpen={showLibrary} onClose={() => setShowLibrary(false)} />
      <AboutMethod isOpen={showAbout} onClose={() => setShowAbout(false)} theme="dark" />
    </div>
  );
}
