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
import { 
  loadMyMirrorSnapshot, 
  deleteMyMirrorSnapshot, 
  MyMirrorSnapshotV1,
  loadTransientDraft,
  saveTransientDraft,
  clearTransientDraft,
  hasMeaningfulDraft,
  TransientDraftV1
} from './services/myMirrorStorage';
import { EmblemDefs } from './art/emblem';

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

  const [transientDraft, setTransientDraft] = useState<TransientDraftV1 | null>(() => {
    const draft = loadTransientDraft();
    return hasMeaningfulDraft(draft) ? draft : null;
  });

  // Dynamic Document Title
  useEffect(() => {
    switch (mode) {
      case 'alabaster':
        document.title = 'Цифровой Код · Алебастровое святилище | Зеркало Себя';
        break;
      case 'myth':
        document.title = 'Личный Миф · Образная линза | Зеркало Себя';
        break;
      case 'meeting':
        document.title = 'Встреча двух зеркал · Синтез | Зеркало Себя';
        break;
      case 'entry':
      default:
        document.title = 'Зеркало Себя — Ведическая нумерология и Личный миф';
        break;
    }
  }, [mode]);

  const refreshSavedSnapshot = () => {
    setSavedSnapshot(loadMyMirrorSnapshot());
  };

  // Sync state to transient draft (sessionStorage)
  useEffect(() => {
    const isMeaningful = !!(codeResult || (codeDate && codeDate.trim().length > 0) || storyResult || (storyInputs && (storyInputs.q1 || storyInputs.q2 || storyInputs.q3 || storyInputs.q4)));
    if (isMeaningful) {
      saveTransientDraft({
        mode,
        codeDate,
        codeResult,
        firstMirror,
        storyInputs,
        storyResult,
        meetingResult,
        meetingUserNote
      });
      setTransientDraft(loadTransientDraft());
    }
  }, [mode, codeDate, codeResult, firstMirror, storyInputs, storyResult, meetingResult, meetingUserNote]);

  const handleRestoreSavedMirror = () => {
    const snapshot = loadMyMirrorSnapshot();
    if (!snapshot) return;

    setCodeDate(snapshot.codeDate);
    setCodeResult(snapshot.codeResult);
    setFirstMirror(snapshot.firstMirror);
    setStoryInputs(snapshot.storyInputs);
    setStoryResult(snapshot.storyResult);
    setMeetingResult(snapshot.meetingResult);
    setMeetingUserNote(snapshot.meetingUserNote ?? '');
    setMode('meeting');
  };

  const handleDeleteSavedMirror = () => {
    deleteMyMirrorSnapshot();
    setSavedSnapshot(null);
  };

  const handleRestoreDraft = () => {
    const draft = loadTransientDraft();
    if (!draft) return;

    if (draft.codeDate) setCodeDate(draft.codeDate);
    if (draft.codeResult) setCodeResult(draft.codeResult);
    if (draft.firstMirror) setFirstMirror(draft.firstMirror);
    if (draft.storyInputs) setStoryInputs(draft.storyInputs);
    if (draft.storyResult) setStoryResult(draft.storyResult);
    if (draft.meetingResult) setMeetingResult(draft.meetingResult);
    if (draft.meetingUserNote) setMeetingUserNote(draft.meetingUserNote);

    if (draft.mode && draft.mode !== 'entry') {
      setMode(draft.mode);
    } else if (draft.codeResult && draft.storyResult) {
      setMode('meeting');
    } else if (draft.codeResult) {
      setMode('alabaster');
    } else if (draft.storyResult || draft.storyInputs) {
      setMode('myth');
    }
  };

  const handleClearDraft = () => {
    clearTransientDraft();
    setTransientDraft(null);
    setCodeDate('');
    setCodeResult(null);
    setFirstMirror(null);
    setStoryInputs(null);
    setStoryResult(null);
    setMeetingResult(null);
    setMeetingUserNote('');
    setMode('entry');
  };

  const hasCode = !!codeResult;
  const hasMyth = !!storyResult;
  const hasBoth = hasCode && hasMyth;

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans relative overflow-x-hidden transition-colors duration-300 ${
      mode === 'alabaster' 
        ? 'bg-[#FCFAF7] text-[#1A1A1C] selection:bg-[#C8A45D]/30 selection:text-[#1A1A1C]'
        : 'bg-[#090D15] text-[#EAEAEA] selection:bg-[var(--color-antique-gold)]/20 selection:text-white'
    }`}>
      <EmblemDefs />
      
      {/* Quiet, Minimalist Header */}
      <header className={`fixed top-0 left-0 w-full flex justify-between items-center z-50 py-2.5 sm:py-3.5 px-3 sm:px-8 pointer-events-none transition-all duration-300 ${
        mode === 'alabaster'
          ? 'bg-[#FCFAF7]/90 text-[#1A1A1C] border-b border-[#1A1A1C]/8 shadow-xs backdrop-blur-md'
          : 'bg-gradient-to-b from-[#090D15]/95 via-[#090D15]/80 to-transparent text-[#EAEAEA] backdrop-blur-sm'
      }`}>
        
        {/* Left: Minimal Logo with >=44px touch target */}
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            onClick={() => setMode('entry')}
            className="group min-w-[44px] min-h-[44px] p-2 flex items-center gap-2.5 text-left transition-all duration-300 cursor-pointer -ml-2"
            title="Главная"
            aria-label="Главная страница Зеркало Себя"
          >
            <span className={`w-2.5 h-2.5 rounded-full bg-[var(--color-antique-gold)] shadow-[0_0_8px_rgba(200,164,93,0.6)] group-hover:scale-125 transition-transform`} />
            <span className={`hidden sm:inline font-serif text-lg tracking-wide transition-colors whitespace-nowrap ${
              mode === 'alabaster'
                ? 'text-[#1A1A1C] group-hover:text-[var(--color-antique-gold)]'
                : 'text-[#F4F4F4] group-hover:text-[var(--color-antique-gold)]'
            }`}>
              Зеркало себя
            </span>
          </button>
        </div>

        {/* Center: Quiet Lens Switcher with comfortable tap targets */}
        <nav aria-label="Режимы исследования" className={`flex items-center gap-1 sm:gap-1.5 p-1 rounded-full pointer-events-auto shadow-sm transition-colors duration-300 ${
          mode === 'alabaster'
            ? 'bg-[#EDEAE4]/90 border border-[#1A1A1C]/10 backdrop-blur-md text-[#63656C]'
            : 'bg-[#0D121D]/85 border border-white/10 backdrop-blur-md text-gray-400'
        }`}>
          
          {/* Digital Code */}
          <button
            onClick={() => setMode('alabaster')}
            className={`min-h-[40px] px-3.5 py-2 rounded-full text-[10px] sm:text-[11px] tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              mode === 'alabaster'
                ? 'bg-[#1A1A1C] text-[#FCFAF7] font-medium shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <span>Код</span>
            {hasCode && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-antique-gold)]" />}
          </button>

          {/* Lens 1: Myth */}
          <button
            onClick={() => setMode('myth')}
            className={`min-h-[40px] px-3.5 py-2 rounded-full text-[10px] sm:text-[11px] tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              mode === 'myth'
                ? 'bg-white/15 text-white font-medium shadow-xs'
                : mode === 'alabaster'
                  ? 'text-[#63656C] hover:text-[#1A1A1C]'
                  : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Миф</span>
            {hasMyth && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-antique-gold)]" />}
          </button>

          {/* Synthesis: Meeting */}
          <button
            onClick={() => setMode('meeting')}
            className={`min-h-[40px] px-3.5 py-2 rounded-full text-[10px] sm:text-[11px] tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              mode === 'meeting'
                ? 'bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] font-medium border border-[var(--color-antique-gold)]/40 shadow-xs'
                : hasBoth
                  ? 'text-[var(--color-antique-gold)] hover:text-amber-200'
                  : mode === 'alabaster'
                    ? 'text-[#63656C] hover:text-[#1A1A1C]'
                    : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Встреча</span>
            {hasBoth && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />}
          </button>
        </nav>

        {/* Right: Quiet About / Notes Links (Desktop & Mobile Accessible) */}
        <div className={`pointer-events-auto flex items-center gap-2 sm:gap-4 text-xs transition-colors duration-300 ${
          mode === 'alabaster' ? 'text-[#63656C]' : 'text-gray-400'
        }`}>
          <button
            onClick={() => setShowAbout(true)}
            className={`min-h-[44px] px-2 py-2 tracking-wider uppercase text-[10px] sm:text-[11px] transition-colors cursor-pointer font-light ${
              mode === 'alabaster' ? 'hover:text-[#1A1A1C]' : 'hover:text-[var(--color-antique-gold)]'
            }`}
          >
            О методе
          </button>

          <button
            onClick={() => setShowLibrary(true)}
            className={`min-h-[44px] px-2 py-2 tracking-wider uppercase text-[10px] sm:text-[11px] transition-colors cursor-pointer font-light ${
              mode === 'alabaster' ? 'hover:text-[#1A1A1C]' : 'hover:text-[var(--color-antique-gold)]'
            }`}
          >
            <span className="hidden sm:inline">Мои заметки</span>
            <span className="sm:hidden">Заметки</span>
          </button>
        </div>
      </header>

      {/* Main Content Area with 300ms Cross-Room Transitions */}
      <main className="w-full flex-grow flex flex-col pt-16">
        <AnimatePresence mode="wait">
          
          {mode === 'alabaster' && (
            <motion.div
              key="alabaster"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-full min-h-screen bg-[#FCFAF7]"
            >
              <AlabasterSanctuary
                initialDate={codeDate}
                initialResult={codeResult}
                initialReading={firstMirror}
                onCodeCalculated={(fullDate, calc, reading) => {
                  setCodeDate(fullDate);
                  setCodeResult(calc);
                  setFirstMirror(reading || null);
                  setMeetingResult(null);
                  setMeetingUserNote('');
                }}
                onBackToCollection={() => setMode('entry')}
                onContinue={() => setMode(hasMyth ? 'meeting' : 'myth')}
                continueLabel={hasMyth ? 'Открыть Встречу зеркал' : 'Перейти к Личному мифу'}
                onOpenAbout={() => setShowAbout(true)}
              />
            </motion.div>
          )}

          {mode === 'entry' && (
            <motion.div
              key="entry"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-full"
            >
              <LabEntryView
                codeResult={codeResult}
                storyResult={storyResult}
                savedSnapshot={savedSnapshot}
                onRestoreSavedMirror={handleRestoreSavedMirror}
                onDeleteSavedMirror={handleDeleteSavedMirror}
                transientDraft={transientDraft}
                onRestoreDraft={handleRestoreDraft}
                onClearDraft={handleClearDraft}
                onSelectMode={(m, initialDate) => {
                  if (initialDate && initialDate !== codeDate) {
                    setCodeDate(initialDate);
                    setCodeResult(null);
                    setFirstMirror(null);
                    setMeetingResult(null);
                    setMeetingUserNote('');
                  } else if (initialDate) {
                    setCodeDate(initialDate);
                  }
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
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-full"
            >
              <PersonalMyth 
                initialInputs={storyInputs}
                initialResult={storyResult}
                onOpenAbout={() => setShowAbout(true)}
                onMythCompleted={(inputs, result) => {
                  setStoryInputs(inputs);
                  setStoryResult(result || null);
                  setMeetingResult(null);
                  setMeetingUserNote('');
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
              transition={{ duration: 0.3, ease: "easeInOut" }}
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
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-full"
            >
              <ModelComparisonHarness />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Global Modals */}
      <MetaphorLibrary isOpen={showLibrary} onClose={() => setShowLibrary(false)} />
      <AboutMethod isOpen={showAbout} onClose={() => setShowAbout(false)} theme={mode === 'alabaster' ? 'light' : 'dark'} />
    </div>
  );
}
