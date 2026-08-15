import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import CodeArchitecture from './components/CodeArchitecture';
import PersonalMyth from './components/PersonalMyth';
import { MeetingOfMirrors } from './components/MeetingOfMirrors';
import { ModelComparisonHarness } from './components/ModelComparisonHarness';
import { LabEntryView } from './components/LabEntryView';
import { GlobalNoise } from './components/GlobalNoise';
import { MetaphorLibrary } from './components/MetaphorLibrary';
import { AboutMethod } from './components/AboutMethod';
import { Library, Compass, GitFork, Sliders, CheckCircle2, Home, Sparkles, Feather } from 'lucide-react';
import { CalculationResult, FirstMirror, StoryInputs, ApiResponse } from './types';

export default function App() {
  const [mode, setMode] = useState<'entry' | 'code' | 'myth' | 'meeting' | 'ab-test'>('entry');
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Shared state between lenses
  const [codeResult, setCodeResult] = useState<CalculationResult | null>(null);
  const [firstMirror, setFirstMirror] = useState<FirstMirror | null>(null);
  const [storyInputs, setStoryInputs] = useState<StoryInputs | null>(null);
  const [storyResult, setStoryResult] = useState<ApiResponse['story_result'] | null>(null);

  const hasCode = !!codeResult;
  const hasMyth = !!storyResult;
  const hasBoth = hasCode && hasMyth;

  return (
    <div className="min-h-screen w-full flex flex-col font-sans bg-[#090D15] text-[#EAEAEA] relative overflow-x-hidden">
      <GlobalNoise />

      {/* Top Floating Navigation */}
      <header className="fixed top-0 left-0 w-full flex justify-between items-center z-50 py-3 px-3 sm:px-6 pointer-events-none">
        
        {/* Left: Home & About */}
        <div className="pointer-events-auto flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setMode('entry')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] tracking-widest uppercase transition-all duration-300 border bg-[#111827]/80 backdrop-blur-md text-gray-300 border-white/10 hover:border-[var(--color-antique-gold)]/60 hover:text-white"
            title="Главная «Зеркало себя»"
          >
            <Home size={13} className="shrink-0 text-[var(--color-antique-gold)]" />
            <span className="hidden sm:inline">Зеркало</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowAbout(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] tracking-widest uppercase transition-all duration-300 border bg-[#111827]/80 backdrop-blur-md text-gray-300 border-white/10 hover:border-[var(--color-antique-gold)]/60 hover:text-white"
            title="О методе"
          >
            <Compass size={13} className="text-[var(--color-antique-gold)] shrink-0" />
            <span className="hidden md:inline">О методе</span>
          </motion.button>
        </div>

        {/* Center: Mode Switcher Pills */}
        <nav aria-label="Режимы исследования" className="flex items-center gap-1 p-1 bg-[#0D121D]/90 backdrop-blur-md rounded-full border border-white/10 pointer-events-auto max-w-[90vw] overflow-x-auto shadow-lg">
          
          {/* Lens 1: Myth */}
          <button
            onClick={() => setMode('myth')}
            className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
              mode === 'myth'
                ? 'bg-purple-950/80 text-purple-200 border border-purple-500/50 font-semibold shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Feather size={11} className="text-purple-300" />
            <span>1. Миф</span>
            {hasMyth && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />}
          </button>

          {/* Lens 2: Code */}
          <button
            onClick={() => setMode('code')}
            className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
              mode === 'code'
                ? 'bg-amber-950/80 text-[var(--color-antique-gold)] border border-amber-500/50 font-semibold shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Compass size={11} className="text-[var(--color-antique-gold)]" />
            <span>2. Код</span>
            {hasCode && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />}
          </button>

          {/* Synthesis: Meeting */}
          <button
            onClick={() => setMode('meeting')}
            className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
              mode === 'meeting'
                ? 'bg-[#182333] text-white border border-[var(--color-antique-gold)]/60 font-semibold shadow-sm'
                : hasBoth
                  ? 'text-[var(--color-antique-gold)] hover:text-amber-200 font-medium'
                  : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <GitFork size={12} className={hasBoth ? 'text-[var(--color-antique-gold)]' : ''} />
            <span>Встреча</span>
          </button>

          {/* A/B Harness */}
          <button
            onClick={() => setMode('ab-test')}
            className={`px-2.5 py-1.5 rounded-full text-[10px] tracking-wider uppercase transition-all flex items-center gap-1 whitespace-nowrap ${
              mode === 'ab-test'
                ? 'bg-[#1A2333] text-[var(--color-antique-gold)] border border-[var(--color-antique-gold)]/40'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Слепое сравнение моделей"
          >
            <Sliders size={11} />
            <span className="hidden md:inline">A/B</span>
          </button>

        </nav>

        {/* Right: Metaphor Library */}
        <div className="pointer-events-auto flex justify-end">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setShowLibrary(true)}
            className="p-2 rounded-full transition-colors flex items-center justify-center text-[var(--color-antique-gold)] bg-[#111827]/80 border border-white/10 hover:border-[var(--color-antique-gold)]/60 backdrop-blur-md"
            title="Библиотека Метафор"
          >
            <Library size={18} strokeWidth={1.5} />
          </motion.button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full flex-grow flex flex-col pt-14">
        <AnimatePresence mode="wait">
          
          {mode === 'entry' && (
            <motion.div
              key="entry"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <LabEntryView
                codeResult={codeResult}
                storyResult={storyResult}
                onSelectMode={(m) => setMode(m)}
              />
            </motion.div>
          )}

          {mode === 'code' && (
            <motion.div
              key="code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <CodeArchitecture 
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
              transition={{ duration: 0.3 }}
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
              transition={{ duration: 0.3 }}
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
              transition={{ duration: 0.3 }}
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
