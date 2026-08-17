import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import PersonalMyth from './components/PersonalMyth';
import { MeetingOfMirrors } from './components/MeetingOfMirrors';
import { ModelComparisonHarness } from './components/ModelComparisonHarness';
import { LabEntryView } from './components/LabEntryView';
import { MetaphorLibrary } from './components/MetaphorLibrary';
import { AboutMethod } from './components/AboutMethod';
import { AlabasterSanctuary } from './components/AlabasterSanctuary';
import { CalculationResult, FirstMirror, StoryInputs, ApiResponse, MeetingOfMirrorsResult } from './types';
import { loadMyMirrorSnapshot, deleteMyMirrorSnapshot, MyMirrorSnapshotV1 } from './services/myMirrorStorage';

export default function App() {
  const [mode, setMode] = useState<'entry' | 'myth' | 'meeting' | 'alabaster' | 'ab-test'>('entry');
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Shared state between lenses
  const [codeDate, setCodeDate] = useState<string>('');
  const [codeResult, setCodeResult] = useState<CalculationResult | null>(null);
  const [firstMirror, setFirstMirror] = useState<FirstMirror | null>(null);
  const [storyInputs, setStoryInputs] = useState<StoryInputs | null>(null);
  const [storyResult, setStoryResult] = useState<ApiResponse['story_result'] | null>(null);
  const [meetingResult, setMeetingResult] = useState<MeetingOfMirrorsResult | null>(null);
  const [meetingUserNote, setMeetingUserNote] = useState<string>('');
  const [savedSnapshot, setSavedSnapshot] = useState<MyMirrorSnapshotV1 | null>(() => {
    return loadMyMirrorSnapshot();
  });

  const refreshSavedSnapshot = () => {
    setSavedSnapshot(loadMyMirrorSnapshot());
  };

  useEffect(() => {
    refreshSavedSnapshot();
  }, [mode]);

  const handleRestoreSavedMirror = () => {
    const snapshot = loadMyMirrorSnapshot();
    if (!snapshot) return;

    setCodeDate(snapshot.codeDate);
    setCodeResult(snapshot.codeResult);
    setFirstMirror(snapshot.firstMirror);
    setStoryInputs(snapshot.storyInputs);
    setStoryResult(snapshot.storyResult);
    setMeetingResult(snapshot.meetingResult);
    if (snapshot.meetingUserNote) {
      setMeetingUserNote(snapshot.meetingUserNote);
    }
    setMode('meeting');
  };

  const handleDeleteSavedMirror = () => {
    deleteMyMirrorSnapshot();
    setSavedSnapshot(null);
  };

  const hasCode = !!codeResult;
  const hasMyth = !!storyResult;
  const hasBoth = hasCode && hasMyth;

  // In Alabaster mode, we render the light sanctuary directly
  if (mode === 'alabaster') {
    return (
      <div className="w-full min-h-screen">
        <AlabasterSanctuary
          initialDate={codeDate}
          onCodeCalculated={(fullDate, calc, reading) => {
            setCodeDate(fullDate);
            setCodeResult(calc);
            if (reading) setFirstMirror(reading);
          }}
          onBackToCollection={() => setMode('entry')}
          onContinue={() => setMode(hasMyth ? 'meeting' : 'myth')}
          continueLabel={hasMyth ? 'Открыть Встречу зеркал' : 'Перейти к Личному мифу'}
          onOpenAbout={() => setShowAbout(true)}
        />
        {/* Global Modals */}
        <MetaphorLibrary isOpen={showLibrary} onClose={() => setShowLibrary(false)} />
        <AboutMethod isOpen={showAbout} onClose={() => setShowAbout(false)} theme="light" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col font-sans bg-[#090D15] text-[#EAEAEA] relative overflow-x-hidden selection:bg-[var(--color-antique-gold)]/20 selection:text-white">
      
      {/* Quiet, Minimalist Header */}
      <header className="fixed top-0 left-0 w-full flex justify-between items-center z-50 py-3.5 px-4 sm:px-8 pointer-events-none bg-gradient-to-b from-[#090D15]/95 via-[#090D15]/80 to-transparent backdrop-blur-sm">
        
        {/* Left: Minimal Logo */}
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            onClick={() => setMode('entry')}
            className="group flex items-center gap-2.5 text-left transition-all duration-300 cursor-pointer"
            title="Главная"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--color-antique-gold)] shadow-[0_0_8px_rgba(200,164,93,0.6)] group-hover:scale-125 transition-transform" />
            <span className="hidden sm:inline font-serif text-lg tracking-wide text-[#F4F4F4] group-hover:text-[var(--color-antique-gold)] transition-colors whitespace-nowrap">
              Зеркало себя
            </span>
          </button>
        </div>

        {/* Center: Quiet Lens Switcher */}
        <nav aria-label="Режимы исследования" className="flex items-center gap-1.5 p-1 bg-[#0D121D]/80 backdrop-blur-md rounded-full border border-white/5 pointer-events-auto shadow-sm">
          
          {/* Digital Code */}
          <button
            onClick={() => setMode('alabaster')}
            className="px-3 py-1.5 rounded-full text-[10px] sm:text-[11px] tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 text-gray-400 hover:text-gray-200"
          >
            <span>Код</span>
            {hasCode && <span className="w-1 h-1 rounded-full bg-[var(--color-antique-gold)]" />}
          </button>

          {/* Lens 1: Myth */}
          <button
            onClick={() => setMode('myth')}
            className={`px-3.5 py-1.5 rounded-full text-[11px] tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 ${
              mode === 'myth'
                ? 'bg-white/10 text-white font-medium shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Миф</span>
            {hasMyth && <span className="w-1 h-1 rounded-full bg-[var(--color-antique-gold)]" />}
          </button>

          {/* Synthesis: Meeting */}
          <button
            onClick={() => setMode('meeting')}
            className={`px-3.5 py-1.5 rounded-full text-[11px] tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 ${
              mode === 'meeting'
                ? 'bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] font-medium border border-[var(--color-antique-gold)]/40 shadow-xs'
                : hasBoth
                  ? 'text-[var(--color-antique-gold)] hover:text-amber-200'
                  : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Встреча</span>
            {hasBoth && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />}
          </button>
        </nav>

        {/* Right: Quiet About / Library Links */}
        <div className="pointer-events-auto flex items-center gap-4 text-xs text-gray-400">
          <button
            onClick={() => setShowAbout(true)}
            className="hover:text-[var(--color-antique-gold)] tracking-wider uppercase text-[11px] transition-colors hidden sm:inline-block cursor-pointer font-light"
          >
            О методе
          </button>

          <button
            onClick={() => setShowLibrary(true)}
            className="hover:text-[var(--color-antique-gold)] tracking-wider uppercase text-[11px] transition-colors hidden md:inline-block cursor-pointer font-light"
          >
            Библиотека
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full flex-grow flex flex-col pt-16">
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
                savedSnapshot={savedSnapshot}
                onRestoreSavedMirror={handleRestoreSavedMirror}
                onDeleteSavedMirror={handleDeleteSavedMirror}
                onSelectMode={(m, initialDate) => {
                  if (initialDate) setCodeDate(initialDate);
                  setMode(m === 'code' ? 'alabaster' : m);
                }}
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
                initialInputs={storyInputs}
                initialResult={storyResult}
                onOpenAbout={() => setShowAbout(true)}
                onMythCompleted={(inputs, result) => {
                  setStoryInputs(inputs);
                  setStoryResult(result || null);
                }}
                onNavigateToMeeting={() => setMode(hasCode ? 'meeting' : 'alabaster')}
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
                codeDate={codeDate}
                codeResult={codeResult}
                firstMirror={firstMirror}
                storyInputs={storyInputs}
                storyResult={storyResult}
                initialMeetingResult={meetingResult}
                onMeetingCompleted={(res) => {
                  setMeetingResult(res);
                  refreshSavedSnapshot();
                }}
                initialUserNote={meetingUserNote}
                onUserNoteChange={setMeetingUserNote}
                onSaveSnapshot={refreshSavedSnapshot}
                onDeleteSnapshot={refreshSavedSnapshot}
                onOpenCode={() => setMode('alabaster')}
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
