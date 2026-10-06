import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import PersonalMyth from './components/PersonalMyth';
import { MeetingOfMirrors } from './components/MeetingOfMirrors';
import { LabEntryView } from './components/LabEntryView';
import { MetaphorLibrary } from './components/MetaphorLibrary';
import { AboutMethod } from './components/AboutMethod';
import { AlabasterSanctuary } from './components/AlabasterSanctuary';
import { CodeV2Experience } from './components/CodeV2/CodeV2Experience';
import { AlbertDialogue } from './components/AlbertDialogue';
import { PersonalStoryLibrary } from './components/PersonalStoryLibrary';
import { CalculationResult, FirstMirror, StoryInputs, ApiResponse, MeetingOfMirrorsResult, CodeV2Payload, UserConclusionStateV1 } from './types';
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
import { firstMirrorFromV2 } from './services/codeV2Session';
import { truthJourneyKey } from './services/albertTruthState';
import { isShortJuxtapositionEnabled } from './services/albertOpenerState';
import { loadQaPanel, type QaPanelModule } from './components/CodeV2/qaPanelLoader';
import { EmblemDefs } from './art/emblem';
import { ConsentBoundary } from './components/ConsentBoundary';
import {useFreePreview,meetingUnavailable} from './services/freePreview';

function sanitizeUrlDob(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (params.has('dob')) {
    params.delete('dob');
    const cleanSearch = params.toString();
    const newUrl = `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', newUrl);
  }
}

export default function App() {
  return <ConsentBoundary><AppContent /></ConsentBoundary>;
}

function AppContent() {
  const [mode, setMode] = useState<'entry' | 'myth' | 'meeting' | 'alabaster'>(() => {
    if (typeof window === 'undefined') return 'entry';
    sanitizeUrlDob();
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === 'v2' || params.get('v') === '2') {
      return 'alabaster';
    }
    return 'entry';
  });
  const [showLibrary, setShowLibrary] = useState(false);
  const [commerceSafetyBlocked,setCommerceSafetyBlocked]=useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Digital Code V2 Preview State
  const [isPreviewV2, setIsPreviewV2] = useState(true);
  const freePreview=useFreePreview();
  const meetingBlocked=meetingUnavailable(freePreview);
  const openOrdinaryAlbert=()=>{setAlbertInitialTopic(undefined);setIsAlbertV2Open(true);};
  const [isQaMode, setIsQaMode] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !import.meta.env.DEV) return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('qa') === '1';
  });
  // DEV-ONLY QA surface module (the owner's V2 preview badge). Loaded through a
  // compile-time `import.meta.env.DEV` branch inside loadQaPanel(): the production
  // bundle contains neither the module nor its copy.
  const [qaPanel, setQaPanel] = useState<QaPanelModule | null>(null);
  useEffect(() => {
    if (!isQaMode || !import.meta.env.DEV) {
      setQaPanel(null);
      return;
    }
    let cancelled = false;
    loadQaPanel()
      .then(m => {
        if (!cancelled) setQaPanel(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isQaMode]);
  const [isAlbertV2Open, setIsAlbertV2Open] = useState(false);
  const [albertInitialTopic, setAlbertInitialTopic] = useState<string | undefined>(undefined);
  const [openerTriggerToken, setOpenerTriggerToken] = useState<number>(0);
  const [isChapterOfferOpen, setIsChapterOfferOpen] = useState<boolean>(()=>new URLSearchParams(window.location.search).get('stories')==='1');
  const [userConclusionState, setUserConclusionState] = useState<UserConclusionStateV1 | null>(null);
  const [codeV2Payload, setCodeV2Payload] = useState<CodeV2Payload | null>(null);

  // Auto-activate preview on direct landing with ?preview=v2 or ?v=2
  useEffect(() => {
    if (typeof window === 'undefined') return;
    sanitizeUrlDob();
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === 'v2' || params.get('v') === '2') {
      setIsPreviewV2(true);
      if (import.meta.env.DEV) {
        setIsQaMode(params.get('qa') === '1');
      }
      setMode('alabaster');
    }
  }, []);

  const [journeyId, setJourneyId] = useState<string>(() => crypto.randomUUID());

  // Shared state between lenses
  const [codeDate, setCodeDate] = useState<string>('');
  const [userQuestion, setUserQuestion] = useState<string>('');
  const [codeReactions, setCodeReactions] = useState<Record<string, 'confirmed' | 'rejected'>>({});
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
        // QA-режим (dev-only) меняет титул из qaPanel-модуля; здесь базовый титул.
        document.title = isPreviewV2
          ? 'Цифровой Код | Зеркало Себя'
          : 'Цифровой Код · Алебастровое святилище | Зеркало Себя';
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
  }, [mode, isPreviewV2, isQaMode]);

  const refreshSavedSnapshot = () => {
    setSavedSnapshot(loadMyMirrorSnapshot());
  };

  // Sync state to transient draft (sessionStorage)
  useEffect(() => {
    const isMeaningful = !!(
      codeResult ||
      (codeDate && codeDate.trim().length > 0) ||
      (userQuestion && userQuestion.trim().length > 0) ||
      storyResult ||
      (storyInputs && (storyInputs.q1 || storyInputs.q2 || storyInputs.q3 || storyInputs.q4))
    );
    if (isMeaningful) {
      saveTransientDraft({
        mode,
        codeDate,
        userQuestion,
        codeReactions,
        codeResult,
        codeV2Payload,
        journeyId,
        firstMirror,
        storyInputs,
        storyResult,
        meetingResult,
        meetingUserNote
      });
      setTransientDraft(loadTransientDraft());
    }
  }, [mode, codeDate, userQuestion, codeReactions, codeResult, codeV2Payload, journeyId, firstMirror, storyInputs, storyResult, meetingResult, meetingUserNote]);

  const handleRestoreSavedMirror = () => {
    const snapshot = loadMyMirrorSnapshot();
    if (!snapshot) return;

    setCodeV2Payload(snapshot.codeV2Payload || null);
    setJourneyId(snapshot.journeyId || truthJourneyKey(snapshot.codeResult, snapshot.storyResult, snapshot.meetingResult));
    setCodeDate(snapshot.codeDate);
    setUserQuestion(snapshot.userQuestion ?? '');
    setCodeReactions(snapshot.codeReactions ?? {});
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

    setCodeV2Payload(draft.codeV2Payload || null);
    setJourneyId(draft.journeyId || truthJourneyKey(draft.codeResult, draft.storyResult, draft.meetingResult));
    setCodeDate(draft.codeDate ?? '');
    setUserQuestion(draft.userQuestion ?? '');
    setCodeReactions(draft.codeReactions ?? {});
    setCodeResult(draft.codeResult ?? null);
    setFirstMirror(draft.firstMirror ?? null);
    setStoryInputs(draft.storyInputs ?? null);
    setStoryResult(draft.storyResult ?? null);
    setMeetingResult(draft.meetingResult ?? null);
    setMeetingUserNote(draft.meetingUserNote ?? '');

    if (draft.mode && draft.mode !== 'entry' && (draft.mode as string) !== 'ab-test') {
      setMode(draft.mode as 'alabaster' | 'myth' | 'meeting');
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
    setUserQuestion('');
    setCodeReactions({});
    setCodeV2Payload(null);
    setJourneyId(crypto.randomUUID());
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
      mode === 'alabaster' && !isPreviewV2
        ? 'bg-[#FCFAF7] text-[#1A1A1C] selection:bg-[#C8A45D]/30 selection:text-[#1A1A1C]'
        : 'bg-[#090D15] text-[#EAEAEA] selection:bg-[var(--color-antique-gold)]/20 selection:text-white'
    }`}>
      <EmblemDefs />
      
      {/* Quiet, Minimalist Header */}
      <header className={`fixed top-0 left-0 w-full flex justify-between items-center z-50 py-2.5 sm:py-3.5 px-3 sm:px-8 pointer-events-none transition-all duration-300 ${
        mode === 'alabaster' && !isPreviewV2
          ? 'bg-[#FCFAF7]/90 text-[#1A1A1C] border-b border-[#1A1A1C]/8 shadow-xs backdrop-blur-md'
          : 'bg-gradient-to-b from-[#090D15]/95 via-[#090D15]/80 to-transparent text-[#EAEAEA] backdrop-blur-sm'
      }`}>
        
        {/* Left: Minimal Logo with >=44px touch target + V2 Preview Chip */}
        <div className="pointer-events-auto flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setMode('entry')}
            className="group min-w-[44px] min-h-[44px] p-2 flex items-center gap-2.5 text-left transition-all duration-300 cursor-pointer -ml-2"
            title="Главная"
            aria-label="Главная страница Зеркало Себя"
          >
            <span className={`w-2.5 h-2.5 rounded-full bg-[var(--color-antique-gold)] shadow-[0_0_8px_rgba(200,164,93,0.6)] group-hover:scale-125 transition-transform`} />
            <span className={`hidden sm:inline font-serif text-lg tracking-wide transition-colors whitespace-nowrap ${
              mode === 'alabaster' && !isPreviewV2
                ? 'text-[#1A1A1C] group-hover:text-[var(--color-antique-gold)]'
                : 'text-[#F4F4F4] group-hover:text-[var(--color-antique-gold)]'
            }`}>
              Зеркало себя
            </span>
          </button>

          {/* Owner preview toggle badge — QA Mode only. Rendered from the dev-only
              module (compile-time DEV branch): no QA copy is shipped in production. */}
          {qaPanel && (
            <qaPanel.QaPreviewToggle
              isPreviewV2={isPreviewV2}
              onToggle={() => {
                const next = !isPreviewV2;
                setIsPreviewV2(next);
                if (next && mode !== 'alabaster') {
                  setMode('alabaster');
                }
              }}
            />
          )}
        </div>

        {/* Center: Quiet Lens Switcher with comfortable tap targets */}
        <nav aria-label="Режимы исследования" className={`flex items-center gap-1 sm:gap-1.5 p-1 rounded-full pointer-events-auto shadow-sm transition-colors duration-300 ${
          mode === 'alabaster' && !isPreviewV2
            ? 'bg-[#EDEAE4]/90 border border-[#1A1A1C]/10 backdrop-blur-md text-[#63656C]'
            : 'bg-[#0D121D]/85 border border-white/10 backdrop-blur-md text-gray-400'
        }`}>
          
          {/* Digital Code */}
          <button
            onClick={() => setMode('alabaster')}
            className={`min-h-[40px] px-3.5 py-2 rounded-full text-[13px] sm:text-sm tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              mode === 'alabaster'
                ? isPreviewV2
                  ? 'bg-[var(--color-antique-gold)]/25 text-amber-200 font-medium border border-[var(--color-antique-gold)]/40 shadow-xs'
                  : 'bg-[#1A1A1C] text-[#FCFAF7] font-medium shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <span>{isQaMode && isPreviewV2 ? 'Код V2' : 'Код'}</span>
            {hasCode && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-antique-gold)]" />}
          </button>

          {/* Lens 1: Myth */}
          <button
            onClick={() => setMode('myth')}
            className={`min-h-[40px] px-3.5 py-2 rounded-full text-[13px] sm:text-sm tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              mode === 'myth'
                ? 'bg-white/15 text-white font-medium shadow-xs'
                : mode === 'alabaster' && !isPreviewV2
                  ? 'text-[#63656C] hover:text-[#1A1A1C]'
                  : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Миф</span>
            {hasMyth && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-antique-gold)]" />}
          </button>

          {/* Synthesis: Meeting */}
          {!meetingBlocked&&<button
            onClick={() => setMode('meeting')}
            className={`min-h-[40px] px-3.5 py-2 rounded-full text-[13px] sm:text-sm tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              mode === 'meeting'
                ? 'bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] font-medium border border-[var(--color-antique-gold)]/40 shadow-xs'
                : hasBoth
                  ? 'text-[var(--color-antique-gold)] hover:text-amber-200'
                  : mode === 'alabaster' && !isPreviewV2
                    ? 'text-[#63656C] hover:text-[#1A1A1C]'
                    : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Встреча</span>
            {hasBoth && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />}
          </button>}
        </nav>

        {/* Right: Quiet About / Notes Links (Desktop & Mobile Accessible) */}
        <div className={`pointer-events-auto hidden sm:flex items-center gap-2 sm:gap-4 text-xs transition-colors duration-300 ${
          mode === 'alabaster' && !isPreviewV2 ? 'text-[#63656C]' : 'text-gray-400'
        }`}>
          <button
            onClick={() => setShowAbout(true)}
            className={`min-h-[44px] px-2 py-2 tracking-wider uppercase text-[13px] sm:text-sm transition-colors cursor-pointer font-light ${
              mode === 'alabaster' && !isPreviewV2 ? 'hover:text-[#1A1A1C]' : 'hover:text-[var(--color-antique-gold)]'
            }`}
          >
            О методе
          </button>

          <button
            onClick={() => setShowLibrary(true)}
            className={`min-h-[44px] px-2 py-2 tracking-wider uppercase text-[13px] sm:text-sm transition-colors cursor-pointer font-light ${
              mode === 'alabaster' && !isPreviewV2 ? 'hover:text-[#1A1A1C]' : 'hover:text-[var(--color-antique-gold)]'
            }`}
          >
            <span className="hidden sm:inline">Мои заметки</span>
            <span className="sm:hidden">Заметки</span>
          </button>
        </div>
        <details className="sm:hidden pointer-events-auto relative shrink-0">
          <summary aria-label="Дополнительно" className="list-none flex min-w-11 min-h-11 cursor-pointer items-center justify-center text-stone-200 text-xl">···</summary>
          <div className="absolute right-0 top-full w-44 rounded-xl bg-[#111827] border border-white/20 shadow-xl p-2">
            <button className="w-full text-left px-3 py-3 text-sm text-stone-100" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setShowAbout(true); }}>О методе</button>
            <button className="w-full text-left px-3 py-3 text-sm text-stone-100" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setShowLibrary(true); }}>Мои заметки</button>
          </div>
        </details>
      </header>

      {/* Main Content Area with 300ms Cross-Room Transitions */}
      <main className="w-full flex-grow flex flex-col pt-16">
        <AnimatePresence mode="wait">
          
          {mode === 'alabaster' && (
            <motion.div
              key={isPreviewV2 ? 'code-v2' : 'alabaster'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className={`w-full min-h-screen ${isPreviewV2 ? 'bg-[#090D15]' : 'bg-[#FCFAF7]'}`}
            >
              {isPreviewV2 ? (
                <CodeV2Experience
                  initialDate={codeDate || ''}
                  initialPayload={codeV2Payload || undefined}
                  userQuestion={userQuestion}
                  onUserQuestionChange={setUserQuestion}
                  initialReactions={codeReactions}
                  onReactionChange={(key, status) => {
                    setCodeReactions(prev => ({ ...prev, [key]: status }));
                  }}
                  onCalculated={(payload) => {
                    setCodeDate(payload.calculation.date);
                    setCodeResult(payload.calculation.canonical_result);
                    setFirstMirror(firstMirrorFromV2(payload));
                    setCodeV2Payload(payload);
                    setCodeReactions({});
                    setMeetingResult(null);
                  }}
                  onChangeDate={() => {
                    clearTransientDraft();
                    setTransientDraft(null);
                    setCodeDate('');
                    setUserQuestion('');
                    setCodeReactions({});
                    setCodeResult(null);
                    setFirstMirror(null);
                    setCodeV2Payload(null);
                    setMeetingResult(null);
                    setMeetingUserNote('');
                    setJourneyId(crypto.randomUUID());
                  }}
                  onContinue={() => hasMyth&&meetingBlocked?openOrdinaryAlbert():setMode(hasMyth ? 'meeting' : 'myth')}
                  continueLabel={hasMyth ? meetingBlocked?'Обсудить с Альбертом':'Открыть Встречу зеркал' : 'Перейти к Личному мифу'}
                  isQaMode={isQaMode && import.meta.env.DEV}
                  onOpenAlbert={(p, options) => {
                    setCodeV2Payload(p);
                    if (options?.userQuestion !== undefined) {
                      setUserQuestion(options.userQuestion);
                    }
                    if (options?.reactionItem) {
                      setCodeReactions(prev => ({
                        ...prev,
                        [options.reactionItem!.key]: options.reactionItem!.status
                      }));
                    }
                    setAlbertInitialTopic(options?.initialPrompt);
                    setIsAlbertV2Open(true);
                  }}
                  onBackToCollection={() => setMode('entry')}
                  onSwitchToV1={() => setIsPreviewV2(false)}
                />
              ) : (
                <AlabasterSanctuary
                  initialDate={codeDate}
                  initialResult={codeResult}
                  initialReading={firstMirror}
                  onCodeCalculated={(fullDate, calc, reading) => {
                    setCodeV2Payload(null);
                    setCodeReactions({});
                    setJourneyId(crypto.randomUUID());
                    setCodeDate(fullDate);
                    setCodeResult(calc);
                    setFirstMirror(reading || null);
                    setMeetingResult(null);
                    setMeetingUserNote('');
                  }}
                  onBackToCollection={() => setMode('entry')}
                  onContinue={() => hasMyth&&meetingBlocked?openOrdinaryAlbert():setMode(hasMyth ? 'meeting' : 'myth')}
                  continueLabel={hasMyth ? meetingBlocked?'Обсудить с Альбертом':'Открыть Встречу зеркал' : 'Перейти к Личному мифу'}
                  onOpenAbout={() => setShowAbout(true)}
                />
              )}
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
                meetingAvailable={!meetingBlocked}
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
                    setCodeV2Payload(null);
                    setCodeReactions({});
                    setJourneyId(crypto.randomUUID());
                    setCodeResult(null);
                    setFirstMirror(null);
                    setMeetingResult(null);
                    setMeetingUserNote('');
                  } else if (initialDate) {
                    setCodeDate(initialDate);
                  }
                  if ((m as string) !== 'ab-test') {
                    if(m==='meeting'&&meetingBlocked)openOrdinaryAlbert();
                    else setMode(m === 'code' ? 'alabaster' : (m as 'alabaster' | 'myth' | 'meeting' | 'entry'));
                  }
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
                onOpenSavedStory={()=>setIsChapterOfferOpen(true)}
                onSafetyBlocked={setCommerceSafetyBlocked}
                initialInputs={storyInputs}
                initialResult={storyResult}
                userQuestion={userQuestion}
                onInputsChange={(inputs) => setStoryInputs(inputs)}
                onOpenAbout={() => setShowAbout(true)}
                onMythCompleted={(inputs, result) => {
                  setStoryInputs(inputs);
                  setStoryResult(result || null);
                  setMeetingResult(null);
                }}
                onOpenAlbertJuxtaposition={() => {
                  setAlbertInitialTopic(undefined);
                  setIsAlbertV2Open(true);
                  setOpenerTriggerToken(prev => prev + 1);
                }}
                onReturnToCode={hasCode ? () => setMode('alabaster') : undefined}
                onNavigateToMeeting={meetingBlocked?undefined:() => setMode(hasCode ? 'meeting' : 'alabaster')}
                hasCodeResult={hasCode}
              />
            </motion.div>
          )}

          {mode==='meeting'&&meetingBlocked&&<motion.section key="meeting-unavailable" className="max-w-2xl mx-auto p-8 space-y-5 text-stone-100" aria-label="Сохранённая Встреча" role="status">
            <h1 className="font-serif text-2xl">{freePreview?'Встреча пока не проверена для пробного доступа':'Проверяем доступность раздела'}</h1>
            <p>Сохранённые тексты и заметки остаются на месте. Можно продолжить разговор напрямую с Альбертом.</p>
            {meetingUserNote&&<p className="whitespace-pre-wrap">{meetingUserNote}</p>}
            <button className="px-5 py-3 rounded border border-amber-300/40" onClick={openOrdinaryAlbert}>Продолжить с Альбертом</button>
            <button className="px-5 py-3 rounded border border-white/20" onClick={()=>setIsChapterOfferOpen(true)}>Мои истории</button>
          </motion.section>}
          {mode === 'meeting' && !meetingBlocked && (
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
                userQuestion={userQuestion}
                onUserQuestionChange={setUserQuestion}
                codeReactions={codeReactions}
                codeV2Payload={codeV2Payload}
                journeyId={journeyId}
                onOpenAlbert={() => {
                  setAlbertInitialTopic(undefined);
                  setIsAlbertV2Open(true);
                }}
                onOpenAlbertJuxtaposition={() => {
                  setAlbertInitialTopic(undefined);
                  setIsAlbertV2Open(true);
                  setOpenerTriggerToken(prev => prev + 1);
                }}
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

        </AnimatePresence>
      </main>

      {/* Global Modals */}
      <MetaphorLibrary isOpen={showLibrary} onClose={() => setShowLibrary(false)} />
      <AboutMethod isOpen={showAbout} onClose={() => setShowAbout(false)} theme={mode === 'alabaster' && !isPreviewV2 ? 'light' : 'dark'} />

      {/* Albert Dialogue Modal for Code V2 Preview & Stage A Short Juxtaposition */}
      <AlbertDialogue
        onSafetyBlocked={setCommerceSafetyBlocked}
        isOpen={isAlbertV2Open}
        onClose={() => {
          setIsAlbertV2Open(false);
          setAlbertInitialTopic(undefined);
        }}
        key={journeyId}
        journeyId={journeyId}
        initialTopic={albertInitialTopic}
        openerTriggerToken={openerTriggerToken}
        userQuestion={userQuestion}
        onUserQuestionChange={setUserQuestion}
        codeDate={codeDate}
        codeReactions={codeReactions}
        userNote={meetingUserNote}
        onUserNoteChange={setMeetingUserNote}
        storyInputs={storyInputs}
        storyResult={storyResult}
        meetingResult={!isShortJuxtapositionEnabled() ? meetingResult : null}
        calc={codeResult}
        codeV2Payload={codeV2Payload}
        codeV2Context={codeV2Payload?.albert_context}
        onReturnToCode={hasCode ? () => {
          setIsAlbertV2Open(false);
          setMode('alabaster');
        } : undefined}
        onReturnToMyth={hasMyth ? () => {
          setIsAlbertV2Open(false);
          setMode('myth');
        } : undefined}
        onOpenPersonalChapterSample={(payload) => {
          setUserConclusionState({
            ...payload,
            updatedAt: new Date().toISOString(),
          });
          setIsChapterOfferOpen(true);
        }}
        theme="dark"
      />

      {!commerceSafetyBlocked&&<button className="fixed bottom-4 right-4 z-40 px-5 py-3 rounded-full bg-[#111c2c] text-[#e0c693] border border-[#bd9d65]/40" onClick={()=>setIsChapterOfferOpen(true)}>{freePreview?.enabled?'Мои истории · бесплатно':'Мои истории · 790 ₽'}</button>}
      <PersonalStoryLibrary
        isOpen={isChapterOfferOpen}
        onClose={() => setIsChapterOfferOpen(false)}
        previousAnswers={storyInputs}
        previousMyth={storyResult}
        onStoriesDeleted={()=>{handleDeleteSavedMirror();handleClearDraft();}}
      />
    </div>
  );
}
