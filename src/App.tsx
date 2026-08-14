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
import { Library, Compass, GitFork, Sliders, CheckCircle2, Home, Sparkles } from 'lucide-react';
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

  const getBackgroundColor = () => {
    switch (mode) {
      case 'code':
        return '#FAFAFA';
      case 'ab-test':
        return '#0B0F0D';
      default:
        return '#0F1412';
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col font-sans transition-colors duration-700 relative" 
      style={{ backgroundColor: getBackgroundColor() }}
    >
      <GlobalNoise />

      {/* Top Floating Navigation */}
      <header className="fixed top-0 left-0 w-full flex justify-between items-center z-50 py-3 px-3 sm:px-6 pointer-events-none">
        
        {/* Left: Home & About */}
        <div className="pointer-events-auto flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setMode('entry')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] tracking-widest uppercase transition-all duration-500 border backdrop-blur-md ${
              mode === 'code'
                ? 'bg-white/80 text-[var(--color-ink)] border-black/10 hover:border-[var(--color-antique-gold)]/50'
                : 'bg-[#1A2621]/80 text-[#A3B8AD] border-[#2A3B33] hover:border-[#A3B8AD] hover:text-[#EAEAEA]'
            }`}
            title="Главная лаборатории"
          >
            <Home size={13} className="shrink-0" />
            <span className="hidden md:inline">Лаборатория</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAbout(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] tracking-widest uppercase transition-all duration-500 border backdrop-blur-md ${
              mode === 'code' 
                ? 'bg-white/80 text-[var(--color-ink)] border-black/10 hover:border-[var(--color-antique-gold)]/50' 
                : 'bg-[#1A2621]/80 text-[#A3B8AD] border-[#2A3B33] hover:border-[#A3B8AD] hover:text-[#EAEAEA]'
            }`}
            title="О методе цифрового кода"
          >
            <Compass size={13} className="text-[var(--color-antique-gold)] shrink-0" />
            <span className="hidden sm:inline">О методе</span>
          </motion.button>
        </div>

        {/* Center: Mode Switcher Pills */}
        <nav aria-label="Режимы исследования" className="flex flex-wrap sm:flex-nowrap justify-center gap-1 p-1 bg-black/20 backdrop-blur-md rounded-2xl sm:rounded-full border border-white/10 pointer-events-auto max-w-[90vw] overflow-x-auto">
          
          {/* Lens 1: Code */}
          <button
            onClick={() => setMode('code')}
            className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
              mode === 'code'
                ? 'bg-white text-gray-900 shadow-sm font-semibold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>1. Код</span>
            {hasCode && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </button>

          {/* Lens 2: Myth */}
          <button
            onClick={() => setMode('myth')}
            className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
              mode === 'myth'
                ? 'bg-[#1A2621] text-[#A3B8AD] border border-[#3A4E43] font-semibold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>2. Миф</span>
            {hasMyth && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </button>

          {/* Synthesis: Meeting */}
          <button
            onClick={() => setMode('meeting')}
            className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
              mode === 'meeting'
                ? 'bg-[#24352D] text-[#EAEAEA] border border-[#4E6B5B] font-semibold'
                : hasBoth
                  ? 'text-[#C8A45D] hover:text-amber-200'
                  : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <GitFork size={12} className={hasBoth ? 'text-[#C8A45D]' : ''} />
            <span>Встреча</span>
          </button>

          {/* Harness: A/B Test */}
          <button
            onClick={() => setMode('ab-test')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full text-[10px] tracking-wider uppercase transition-all flex items-center gap-1 whitespace-nowrap ${
              mode === 'ab-test'
                ? 'bg-[#1C2420] text-[#C8A45D] border border-[#3D4F44]'
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
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowLibrary(true)}
            className={`p-2 rounded-full transition-colors flex items-center justify-center ${
              mode === 'code' ? 'text-[var(--color-antique-gold)] hover:bg-black/5' : 'text-[#A3B8AD] hover:bg-white/5'
            }`}
            title="Библиотека Метафор"
          >
            <Library size={20} strokeWidth={1.5} />
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
              transition={{ duration: 0.4 }}
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
              transition={{ duration: 0.4 }}
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
      <AboutMethod isOpen={showAbout} onClose={() => setShowAbout(false)} theme={mode === 'code' ? 'light' : 'dark'} />
    </div>
  );
}
