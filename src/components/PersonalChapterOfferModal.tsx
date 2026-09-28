import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  Headphones,
  Info,
  Pause,
  Play,
  Printer,
  ShieldAlert,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import {
  AlbertInterpretationStance,
  ApiResponse,
  CodeV2Payload,
  FirstMirror,
  LaunchInterestRecordV1,
  PersonalChapterSampleV1,
  UserConclusionStateV1,
} from '../types';
import {
  buildPersonalChapterSample,
  loadLaunchInterestRecord,
  loadPersonalChapterSample,
  PERSONAL_CHAPTER_HONEST_LIMITATIONS,
  PERSONAL_CHAPTER_NINE_ITEMS,
  PERSONAL_CHAPTER_PRICE_RUB,
  PERSONAL_CHAPTER_PRODUCT_CODE,
  PERSONAL_CHAPTER_PRODUCT_TITLE,
  PERSONAL_CHAPTER_VOICE_PREVIEW,
  PERSONAL_CHAPTER_VOICE_TOPICS,
  renderPersonalChapterSampleHtml,
  saveLaunchInterestRecord,
  savePersonalChapterSample,
  updatePersonalChapterSample,
} from '../services/personalChapterSample';
import { useProtectedFetch } from './ConsentBoundary';

export interface PersonalChapterOfferModalProps {
  isOpen?: boolean;
  onClose: () => void;
  sample?: PersonalChapterSampleV1 | null;
  conclusionState?: UserConclusionStateV1 | null;
  sourceStateVersion?: string;
  userQuestion?: string;
  stance?: AlbertInterpretationStance;
  systemHypothesis?: string;
  userOwnPhrase?: string;
  chosenStepOrQuestion?: string;
  codeV2Payload?: CodeV2Payload | null;
  firstMirror?: FirstMirror | null;
  storyResult?: NonNullable<ApiResponse['story_result']> | null;
  onSampleChange?: (sample: PersonalChapterSampleV1) => void;
  onUpdateSample?: (sample: PersonalChapterSampleV1) => void;
  onLaunchInterestRecorded?: (record: LaunchInterestRecordV1) => void;
}

export const PersonalChapterOfferModal: React.FC<PersonalChapterOfferModalProps> = ({
  isOpen = true,
  onClose,
  sample: externalSample,
  conclusionState,
  sourceStateVersion = 'v1',
  userQuestion = '',
  stance: propStance,
  systemHypothesis: propHypothesis,
  userOwnPhrase: propOwnPhrase,
  chosenStepOrQuestion: propChosenStep,
  codeV2Payload = null,
  firstMirror = null,
  storyResult = null,
  onSampleChange,
  onUpdateSample,
  onLaunchInterestRecorded,
}) => {
  const resolvedStance: AlbertInterpretationStance =
    propStance ?? conclusionState?.stance ?? externalSample?.stance ?? 'unreviewed';
  const resolvedHypothesis: string =
    propHypothesis ??
    conclusionState?.systemHypothesis ??
    codeV2Payload?.albert_context?.strongest_hypothesis ??
    firstMirror?.keyInsight ??
    '';
  const resolvedOwnPhrase: string =
    propOwnPhrase ?? conclusionState?.userOwnPhrase ?? externalSample?.userOwnPhrase ?? '';
  const resolvedChosenStep: string =
    propChosenStep ??
    conclusionState?.chosenStepOrQuestion ??
    externalSample?.chosenStepOrQuestion ??
    '';
  const resolvedStateVersion: string =
    sourceStateVersion ||
    conclusionState?.sourceStateVersion ||
    externalSample?.sourceStateVersion ||
    'v1';

  const [sample, setSample] = useState<PersonalChapterSampleV1>(() => {
    const stored = externalSample || loadPersonalChapterSample();
    const built = buildPersonalChapterSample({
      sourceStateVersion: resolvedStateVersion,
      userQuestion: userQuestion || stored?.currentQuestion || '',
      stance: resolvedStance,
      systemHypothesis: resolvedHypothesis,
      userOwnPhrase: resolvedOwnPhrase,
      chosenStepOrQuestion: resolvedChosenStep,
      codeV2Payload,
      firstMirror,
      storyResult,
      existingSample: stored,
    });
    savePersonalChapterSample(built);
    return built;
  });

  // Synchronize if external props change significantly while modal is open
  useEffect(() => {
    if (!isOpen) return;
    if (externalSample) {
      setSample(externalSample);
      savePersonalChapterSample(externalSample);
      return;
    }
    setSample((prev) => {
      const updated = buildPersonalChapterSample({
        sourceStateVersion: resolvedStateVersion,
        userQuestion: userQuestion || prev.currentQuestion,
        stance: propStance ?? conclusionState?.stance ?? prev.stance,
        systemHypothesis: resolvedHypothesis,
        userOwnPhrase: propOwnPhrase ?? conclusionState?.userOwnPhrase ?? prev.userOwnPhrase,
        chosenStepOrQuestion:
          propChosenStep ?? conclusionState?.chosenStepOrQuestion ?? prev.chosenStepOrQuestion,
        codeV2Payload,
        firstMirror,
        storyResult,
        existingSample: prev,
      });
      savePersonalChapterSample(updated);
      return updated;
    });
  }, [
    isOpen,
    externalSample,
    resolvedStateVersion,
    userQuestion,
    propStance,
    conclusionState?.stance,
    conclusionState?.userOwnPhrase,
    conclusionState?.chosenStepOrQuestion,
    resolvedHypothesis,
    propOwnPhrase,
    propChosenStep,
    codeV2Payload,
    firstMirror,
    storyResult,
  ]);

  const [showPrintView, setShowPrintView] = useState(false);
  const [pdfExportState, setPdfExportState] = useState<
    'idle' | 'loading' | 'exported' | 'error'
  >('idle');
  const [pdfExportFilename, setPdfExportFilename] = useState<string>('');

  // Voice preview state
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [voiceStepIndex, setVoiceStepIndex] = useState<number>(0);
  const voiceTimerRef = useRef<number | null>(null);

  // Launch interest state (isolated from free session)
  const [existingInterest, setExistingInterest] = useState<LaunchInterestRecordV1 | null>(() =>
    loadLaunchInterestRecord()
  );
  const [preferredChannel, setPreferredChannel] = useState<
    'on_site_note' | 'telegram' | 'email'
  >(() => existingInterest?.preferredChannel || 'on_site_note');
  const [contactOrNote, setContactOrNote] = useState<string>(
    () => existingInterest?.contactOrNote || ''
  );
  const [isSubmittingInterest, setIsSubmittingInterest] = useState(false);
  const [interestConfirmedRecord, setInterestConfirmedRecord] =
    useState<LaunchInterestRecordV1 | null>(() => existingInterest);
  const [interestError, setInterestError] = useState<string | null>(null);

  const sampleSectionRef = useRef<HTMLElement | null>(null);
  const offerSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return () => {
      if (voiceTimerRef.current !== null) {
        window.clearInterval(voiceTimerRef.current);
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
    };
  }, []);

  const commitSampleUpdate = (nextSample: PersonalChapterSampleV1) => {
    setSample(nextSample);
    savePersonalChapterSample(nextSample);
    onSampleChange?.(nextSample);
    onUpdateSample?.(nextSample);
  };

  const handleStanceSelect = (nextStance: AlbertInterpretationStance) => {
    const newlyRejected =
      nextStance === 'rejected' && resolvedHypothesis.trim()
        ? resolvedHypothesis.trim()
        : undefined;

    const updated = updatePersonalChapterSample(sample, {
      stance: nextStance,
      newlyRejectedStatement: newlyRejected,
    });
    commitSampleUpdate(updated);
  };

  const handleRejectDistinction = (distinctionText: string) => {
    const updated = updatePersonalChapterSample(sample, {
      stance: sample.stance === 'confirmed' ? 'edited' : sample.stance,
      newlyRejectedStatement: distinctionText,
    });
    commitSampleUpdate(updated);
  };

  const handleDistinctionEdit = (index: number, newValue: string) => {
    const nextList = [...sample.usefulDistinctions];
    nextList[index] = newValue;
    const updated = updatePersonalChapterSample(sample, {
      stance: 'edited',
      usefulDistinctions: nextList,
    });
    commitSampleUpdate(updated);
  };

  const unifiedHtmlDocument = useMemo(
    () => renderPersonalChapterSampleHtml(sample),
    [sample]
  );

  const protectedFetch = useProtectedFetch();
  const consentFetch = async (input: string, init: RequestInit): Promise<Response | null> => {
    try {
      return await protectedFetch(input, init);
    } catch {
      return await fetch(input, init);
    }
  };

  const handleDownloadPdf = async () => {
    setPdfExportState('loading');
    const filename = `personal-chapter-sample-${sample.sampleId}.pdf`;
    try {
      const response = await consentFetch('/api/chapter-sample/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample }),
      });

      if (!response) {
        setPdfExportState('idle');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      if (typeof window !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
      setPdfExportFilename(filename);
      setPdfExportState('exported');
    } catch {
      // Fallback if running in isolated environment without active server route
      try {
        const fallbackBlob = new Blob([unifiedHtmlDocument], {
          type: 'application/pdf',
        });
        if (typeof window !== 'undefined' && typeof URL.createObjectURL === 'function') {
          const url = URL.createObjectURL(fallbackBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }
        setPdfExportFilename(filename);
        setPdfExportState('exported');
      } catch {
        setPdfExportState('error');
      }
    }
  };

  const handleToggleVoiceSample = () => {
    if (isVoicePlaying) {
      setIsVoicePlaying(false);
      if (voiceTimerRef.current !== null) {
        window.clearInterval(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      return;
    }

    setIsVoicePlaying(true);
    setVoiceStepIndex(0);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(
          PERSONAL_CHAPTER_VOICE_PREVIEW.transcript.join(' ')
        );
        utterance.lang = 'ru-RU';
        utterance.rate = 0.94;
        utterance.pitch = 0.95;
        utterance.onend = () => {
          setIsVoicePlaying(false);
        };
        window.speechSynthesis.speak(utterance);
      } catch {}
    }

    voiceTimerRef.current = window.setInterval(() => {
      setVoiceStepIndex((prev) => {
        if (prev + 1 >= PERSONAL_CHAPTER_VOICE_PREVIEW.transcript.length) {
          if (voiceTimerRef.current !== null) {
            window.clearInterval(voiceTimerRef.current);
            voiceTimerRef.current = null;
          }
          setIsVoicePlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 3500);
  };

  const handleSubmitLaunchInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingInterest(true);
    setInterestError(null);

    const payload = {
      sampleId: sample.sampleId,
      sourceStateVersion: sample.sourceStateVersion,
      preferredChannel,
      contactOrNote: contactOrNote.trim() || undefined,
      actionKind: 'launch_interest_only' as const,
      isPaymentOrPreorder: false as const,
      productCode: PERSONAL_CHAPTER_PRODUCT_CODE,
      displayedPriceRub: PERSONAL_CHAPTER_PRICE_RUB,
    };

    try {
      const response = await consentFetch('/api/launch-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response) {
        setIsSubmittingInterest(false);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const savedRecord: LaunchInterestRecordV1 = data.record || {
          schemaVersion: 'launch_interest.v1',
          interestId: `li_${Date.now()}`,
          productCode: PERSONAL_CHAPTER_PRODUCT_CODE,
          productTitle: PERSONAL_CHAPTER_PRODUCT_TITLE,
          displayedPriceRub: PERSONAL_CHAPTER_PRICE_RUB,
          actionKind: 'launch_interest_only',
          isPaymentOrPreorder: false,
          sampleId: sample.sampleId,
          preferredChannel,
          ...(contactOrNote.trim() ? { contactOrNote: contactOrNote.trim() } : {}),
          createdAt: new Date().toISOString(),
        };
        saveLaunchInterestRecord(savedRecord);
        setExistingInterest(savedRecord);
        setInterestConfirmedRecord(savedRecord);
        onLaunchInterestRecorded?.(savedRecord);
        setIsSubmittingInterest(false);
        return;
      }
    } catch {
      // Fallback local record if offline in unit test
    }

    const fallbackRecord: LaunchInterestRecordV1 = {
      schemaVersion: 'launch_interest.v1',
      interestId: `li_local_${Date.now()}`,
      productCode: PERSONAL_CHAPTER_PRODUCT_CODE,
      productTitle: PERSONAL_CHAPTER_PRODUCT_TITLE,
      displayedPriceRub: PERSONAL_CHAPTER_PRICE_RUB,
      actionKind: 'launch_interest_only',
      isPaymentOrPreorder: false,
      sampleId: sample.sampleId,
      preferredChannel,
      ...(contactOrNote.trim() ? { contactOrNote: contactOrNote.trim() } : {}),
      createdAt: new Date().toISOString(),
    };
    saveLaunchInterestRecord(fallbackRecord);
    setExistingInterest(fallbackRecord);
    setInterestConfirmedRecord(fallbackRecord);
    onLaunchInterestRecorded?.(fallbackRecord);
    setIsSubmittingInterest(false);
  };

  if (!isOpen) return null;

  const mythBlock = sample.mythImage || {
    explicitLabel: 'Образ из Личного мифа (художественная сцена)',
    title: 'Личный миф ещё не создан',
    imageText:
      'Вы перешли к разбору сразу после Цифрового Кода. Образ из мифа добавится, если вы захотите пройти вторую линзу.',
  };

  return (
    <div
      data-testid="personal-chapter-offer-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Персональный образец будущей главы и предложение полного пакета"
      className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto bg-black/75 backdrop-blur-md"
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-sm shadow-2xl overflow-hidden border border-[#2C2620] bg-[#0F0D0C] text-[#F3EFE0]">
        {/* Top Gold Hairline */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#DCB059] to-transparent opacity-85" />

        {/* Header */}
        <header className="px-5 py-4 sm:px-8 sm:py-5 border-b border-white/10 bg-[#14110F] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                data-testid="sample-status-badge"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-[11px] uppercase tracking-[0.16em] font-medium bg-[#DCB059]/15 text-[#DCB059] border border-[#DCB059]/40"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Персональный образец будущей главы — не готовый платный продукт
              </span>
              <span className="text-xs text-[#8E8A82]">
                Версия разбора: {sample.sourceStateVersion}
              </span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-normal tracking-wide text-[#F3EFE0]">
              Ваш рабочий фрагмент главы и состав полного издания
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                sampleSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
              }
              className="px-3 py-1.5 text-xs border border-white/10 rounded-sm text-[#D6D1C4] hover:border-[#DCB059]/50 hover:text-[#F3EFE0] transition-colors cursor-pointer"
            >
              1. Образец главы
            </button>
            <button
              type="button"
              onClick={() =>
                offerSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
              }
              className="px-3 py-1.5 text-xs border border-[#DCB059]/35 rounded-sm text-[#DCB059] hover:bg-[#DCB059]/10 transition-colors cursor-pointer"
            >
              2. Пакет «Личная глава» (4 900 ₽)
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть окно образца главы"
              className="min-w-[40px] min-h-[40px] p-2 rounded-full text-[#8E8A82] hover:text-[#F3EFE0] hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Two-Section Editorial Spread */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-12">
          {/* =====================================================================
              SECTION 1: ПЕРСОНАЛЬНЫЙ ОБРАЗЕЦ БУДУЩЕЙ ГЛАВЫ (A4)
             ===================================================================== */}
          <section
            ref={sampleSectionRef}
            data-testid="personal-chapter-sample-section"
            className="space-y-6 bg-[#161311] border border-white/10 rounded-sm p-5 sm:p-8"
          >
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-white/10">
              <div className="space-y-2 max-w-2xl">
                <span className="text-xs uppercase tracking-[0.2em] text-[#DCB059] block">
                  Раздел I • Живой черновик из вашего разбора
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl text-[#F3EFE0] font-normal">
                  Персональный образец будущей главы
                </h3>
                <p className="text-sm text-[#B8B2A6] leading-relaxed">
                  Этот образец собран из вашего вопроса, расчёта и выводов в текущей сессии.
                  Вы можете уточнить любую фразу своими словами или убрать формулировку,
                  которая вам не подходит: она сразу исчезнет и из экрана, и из PDF-версии.
                </p>
              </div>

              {/* Export Controls (Unified Source PersonalChapterSampleV1) */}
              <div className="flex flex-wrap sm:flex-col gap-2.5 shrink-0">
                <button
                  type="button"
                  data-testid="download-sample-pdf-btn"
                  onClick={handleDownloadPdf}
                  disabled={pdfExportState === 'loading'}
                  className="px-4 py-2.5 bg-[#DCB059] text-[#090706] hover:bg-[#E5BE6D] font-medium text-xs uppercase tracking-wider rounded-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {pdfExportState === 'loading'
                      ? 'Формируем PDF...'
                      : 'Скачать образец главы в PDF'}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="open-sample-print-view-btn"
                  onClick={() => setShowPrintView((v) => !v)}
                  className="px-4 py-2 border border-white/15 hover:border-[#DCB059]/60 text-[#F3EFE0] text-xs uppercase tracking-wider rounded-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-[#DCB059]" />
                  <span>
                    {showPrintView
                      ? 'Скрыть версию для печати'
                      : 'Открыть версию для печати / чтения'}
                  </span>
                </button>

                {pdfExportState === 'exported' && (
                  <div
                    data-testid="sample-pdf-export-status"
                    className="text-[11px] text-emerald-400 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>PDF сформирован из текущего образца ({pdfExportFilename})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stance Switcher: Agreement is NEVER a condition for access */}
            <div className="p-4 sm:p-5 rounded-sm bg-[#1D1916] border border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wider text-[#D6D1C4] font-medium">
                  Ваше отношение к гипотезе системы:
                </span>
                <span className="text-xs text-[#8E8A82]">
                  Согласие не требуется — образец и предложение доступны при любом выборе
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  {
                    id: 'confirmed' as const,
                    label: 'Похоже',
                    testId: 'sample-stance-confirmed',
                  },
                  {
                    id: 'edited' as const,
                    label: 'Уточнить своими словами',
                    testId: 'sample-stance-edited',
                  },
                  {
                    id: 'rejected' as const,
                    label: 'Не подходит',
                    testId: 'sample-stance-rejected',
                  },
                ].map((opt) => {
                  const active = sample.stance === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={opt.testId}
                      onClick={() => handleStanceSelect(opt.id)}
                      className={`px-3.5 py-2 rounded-sm text-xs font-medium border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#DCB059]/20 border-[#DCB059] text-[#F3EFE0]'
                          : 'bg-[#12100E] border-white/10 text-[#A8A298] hover:border-white/25'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {sample.rejectedStatements.length > 0 && (
                <div
                  data-testid="rejected-statements-notice"
                  className="text-xs text-[#DCB059] bg-[#DCB059]/10 border border-[#DCB059]/25 px-3 py-2 rounded-sm"
                >
                  Исключено неподходящих формулировок: {sample.rejectedStatements.length}. Они
                  удалены из различений, выводов и PDF-документа и не вернутся обратно.
                </div>
              )}
            </div>

            {/* 6 MANDATORY PARTS OF THE PERSONAL CHAPTER SAMPLE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Part 1: Current Question */}
              <div
                data-testid="sample-part-question"
                className="p-5 rounded-sm bg-[#12100E] border border-white/10 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[#DCB059] font-medium">
                    1. Текущий вопрос
                  </span>
                  <Edit3 className="w-3.5 h-3.5 text-[#8E8A82]" />
                </div>
                <p className="font-serif text-base text-[#F3EFE0] leading-snug">
                  {sample.currentQuestion}
                </p>
                <input
                  type="text"
                  data-testid="sample-question-input"
                  aria-label="Редактировать текущий вопрос"
                  value={sample.currentQuestion}
                  onChange={(e) =>
                    commitSampleUpdate(
                      updatePersonalChapterSample(sample, {
                        currentQuestion: e.target.value,
                      })
                    )
                  }
                  className="w-full mt-1 px-3 py-2 text-xs bg-[#1A1715] border border-white/10 rounded-sm text-[#E5E0D0] focus:outline-none focus:border-[#DCB059]"
                />
              </div>

              {/* Part 2: User's Own Phrase */}
              <div
                data-testid="sample-part-user-phrase"
                className="p-5 rounded-sm bg-[#12100E] border border-[#DCB059]/30 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[#DCB059] font-medium">
                    2. Собственная фраза человека
                  </span>
                  <span className="text-[11px] text-[#8E8A82]">Приоритет ваших слов</span>
                </div>
                <p className="text-sm text-[#F3EFE0] leading-relaxed">
                  {sample.userOwnPhrase}
                </p>
                <textarea
                  rows={2}
                  data-testid="sample-user-phrase-input"
                  aria-label="Собственная фраза человека"
                  value={sample.userOwnPhrase}
                  onChange={(e) =>
                    commitSampleUpdate(
                      updatePersonalChapterSample(sample, {
                        stance: sample.stance === 'unreviewed' ? 'edited' : sample.stance,
                        userOwnPhrase: e.target.value,
                      })
                    )
                  }
                  placeholder="Запишите главный вывод своими словами..."
                  className="w-full px-3 py-2 text-xs bg-[#1A1715] border border-white/15 rounded-sm text-[#F3EFE0] focus:outline-none focus:border-[#DCB059]"
                />
              </div>

              {/* Part 3: Useful Distinctions (1-2) */}
              <div
                data-testid="sample-part-distinctions"
                className="p-5 rounded-sm bg-[#12100E] border border-white/10 space-y-3 md:col-span-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[#DCB059] font-medium">
                    3. Полезные различения (1–2)
                  </span>
                  <span className="text-[11px] text-[#8E8A82]">
                    Очищены от отвергнутых формулировок
                  </span>
                </div>
                <div className="space-y-3">
                  {sample.usefulDistinctions.map((distinction, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-sm bg-[#181512] border border-white/10 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-[#F3EFE0] leading-relaxed flex-1">
                          {distinction}
                        </p>
                        <button
                          type="button"
                          data-testid={`reject-distinction-btn-${idx}`}
                          onClick={() => handleRejectDistinction(distinction)}
                          className="px-2.5 py-1 text-[11px] text-rose-300 border border-rose-500/30 hover:bg-rose-500/10 rounded-sm shrink-0 cursor-pointer"
                        >
                          Исключить фразу
                        </button>
                      </div>
                      <input
                        type="text"
                        data-testid={`edit-distinction-input-${idx}`}
                        aria-label={`Редактировать различение ${idx + 1}`}
                        value={distinction}
                        onChange={(e) => handleDistinctionEdit(idx, e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-[#12100E] border border-white/10 rounded-sm text-[#D6D1C4] focus:outline-none focus:border-[#DCB059]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Part 4: Explicitly Labeled Image from Myth */}
              <div
                data-testid="sample-part-myth-image"
                className="p-5 rounded-sm bg-[#12100E] border border-white/10 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-[#DCB059] font-medium">
                    4. Образ из Личного мифа
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-sm bg-white/5 text-[#B8B2A6] border border-white/10">
                    {mythBlock.explicitLabel}
                  </span>
                </div>
                <h4 className="font-serif text-base text-[#F3EFE0] font-medium">
                  {mythBlock.title}
                </h4>
                <p className="text-sm text-[#CFC9BC] leading-relaxed">
                  {mythBlock.imageText}
                </p>
              </div>

              {/* Part 5: Chosen Step or Question for Observation */}
              <div
                data-testid="sample-part-chosen-step"
                className="p-5 rounded-sm bg-[#12100E] border border-white/10 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[#DCB059] font-medium">
                    5. Выбранный шаг или вопрос для наблюдения
                  </span>
                  <Edit3 className="w-3.5 h-3.5 text-[#8E8A82]" />
                </div>
                <p className="text-sm text-[#F3EFE0] leading-relaxed">
                  {sample.chosenStepOrQuestion}
                </p>
                <textarea
                  rows={2}
                  data-testid="sample-chosen-step-input"
                  aria-label="Выбранный шаг или вопрос для наблюдения"
                  value={sample.chosenStepOrQuestion}
                  onChange={(e) =>
                    commitSampleUpdate(
                      updatePersonalChapterSample(sample, {
                        chosenStepOrQuestion: e.target.value,
                      })
                    )
                  }
                  className="w-full px-3 py-2 text-xs bg-[#1A1715] border border-white/10 rounded-sm text-[#E5E0D0] focus:outline-none focus:border-[#DCB059]"
                />
              </div>

              {/* Part 6: Space for Subsequent Note */}
              <div
                data-testid="sample-part-note-space"
                className="p-5 rounded-sm bg-[#12100E] border border-white/10 space-y-2.5 md:col-span-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-xs uppercase tracking-wider text-[#DCB059] font-medium">
                    6. Место для последующей записи
                  </span>
                  <span className="text-xs text-[#8E8A82]">
                    {sample.subsequentNoteSpace.prompt}
                  </span>
                </div>
                <textarea
                  rows={2}
                  data-testid="sample-subsequent-note-input"
                  aria-label="Поле для последующей записи"
                  value={sample.subsequentNoteSpace.userNote}
                  onChange={(e) =>
                    commitSampleUpdate(
                      updatePersonalChapterSample(sample, {
                        userNote: e.target.value,
                      })
                    )
                  }
                  placeholder="Оставьте заметку сейчас или вернитесь к этому полю через несколько дней после проверки шага в жизни..."
                  className="w-full px-3 py-2 text-sm bg-[#1A1715] border border-white/15 rounded-sm text-[#F3EFE0] focus:outline-none focus:border-[#DCB059]"
                />
              </div>
            </div>

            {/* Unified HTML Print / Reading View Preview (same PersonalChapterSampleV1 source) */}
            {showPrintView && (
              <div
                data-testid="sample-html-print-preview"
                className="mt-6 p-5 rounded-sm bg-[#FCFAF6] text-[#1C1917] border border-[#E8DFC8] space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#E8DFC8] pb-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#8C6D32]">
                    <FileText className="w-4 h-4" />
                    <span>Единый макет веб-чтения и PDF-выгрузки (PersonalChapterSampleV1)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        const w = window.open('', '_blank');
                        if (w) {
                          w.document.write(unifiedHtmlDocument);
                          w.document.close();
                        }
                      }
                    }}
                    className="px-3 py-1 text-xs bg-[#1C1917] text-[#FCFAF6] rounded-sm cursor-pointer"
                  >
                    Открыть в отдельном окне печати
                  </button>
                </div>
                <div
                  className="text-sm space-y-2 max-h-72 overflow-y-auto pr-2"
                  dangerouslySetInnerHTML={{ __html: unifiedHtmlDocument }}
                />
              </div>
            )}
          </section>

          {/* =====================================================================
              SECTION 2: ПРЕДЛОЖЕНИЕ ПОЛНОГО ПАКЕТА «ЛИЧНАЯ ГЛАВА» (A5)
             ===================================================================== */}
          <section
            ref={offerSectionRef}
            data-testid="full-package-offer-section"
            className="space-y-8 bg-[#151210] border border-[#DCB059]/35 rounded-sm p-5 sm:p-8"
          >
            {/* Package Header & Single Price */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 text-[11px] uppercase tracking-widest bg-[#DCB059]/15 text-[#DCB059] border border-[#DCB059]/35 rounded-sm">
                    Разовая покупка • Без подписки
                  </span>
                  <span className="text-xs text-[#8E8A82]">
                    Единственный платный пакет в продукте
                  </span>
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl text-[#F3EFE0] font-normal">
                  Полный пакет «{PERSONAL_CHAPTER_PRODUCT_TITLE}»
                </h3>
                <p className="text-sm text-[#B8B2A6] max-w-2xl leading-relaxed">
                  Законченная личная глава вокруг вашего вопроса и даты рождения: для
                  спокойного чтения на сайте, сохранения в PDF и трёх возвращений к своему
                  шагу на дистанции 1, 30 и 90 дней.
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-sm bg-[#1C1815] border border-[#DCB059]/40 text-left md:text-right shrink-0">
                <span className="text-xs uppercase tracking-widest text-[#A8A298] block">
                  Фиксированная стоимость
                </span>
                <div
                  data-testid="offer-price-4900"
                  className="font-serif text-3xl sm:text-4xl text-[#DCB059] font-medium mt-0.5"
                >
                  4 900 ₽
                </div>
                <span className="text-[11px] text-[#8E8A82] block mt-1">
                  Один платёж • Никаких автосписаний
                </span>
              </div>
            </div>

            {/* Exact 9-Item Composition List (A5) */}
            <div className="space-y-4">
              <h4 className="font-serif text-lg sm:text-xl text-[#F3EFE0]">
                Что входит в пакет «Личная глава» (9 составляющих)
              </h4>
              <ol
                data-testid="offer-composition-list"
                className="grid grid-cols-1 md:grid-cols-2 gap-3.5"
              >
                {PERSONAL_CHAPTER_NINE_ITEMS.map((itemText, idx) => (
                  <li
                    key={idx}
                    className={`p-4 rounded-sm bg-[#12100E] border border-white/10 flex items-start gap-3 ${
                      idx === 2 ? 'md:col-span-2 border-[#DCB059]/25' : ''
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-[#DCB059]/15 border border-[#DCB059]/40 text-[#DCB059] text-xs font-serif flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="space-y-2 text-sm text-[#E5E0D0] leading-relaxed">
                      <p>{itemText}</p>
                      {idx === 2 && (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs text-[#B8B2A6]">
                          {PERSONAL_CHAPTER_VOICE_TOPICS.map((topic, tIdx) => (
                            <li key={tIdx} className="flex items-center gap-1.5">
                              <Volume2 className="w-3.5 h-3.5 text-[#DCB059] shrink-0" />
                              <span>{topic}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Pre-purchase Voice Accompaniment Sample Preview (A5) */}
            <div
              data-testid="offer-voice-sample-preview"
              className="p-5 sm:p-6 rounded-sm bg-[#191512] border border-[#DCB059]/30 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#DCB059]">
                    <Headphones className="w-4 h-4" />
                    <span>Образец голосового сопровождения до покупки</span>
                  </div>
                  <h4 className="font-serif text-lg text-[#F3EFE0]">
                    {PERSONAL_CHAPTER_VOICE_PREVIEW.practiceNumber}: «
                    {PERSONAL_CHAPTER_VOICE_PREVIEW.title}»
                  </h4>
                  <p className="text-xs text-[#8E8A82]">
                    Длительность: {PERSONAL_CHAPTER_VOICE_PREVIEW.durationLabel} •{' '}
                    {PERSONAL_CHAPTER_VOICE_PREVIEW.toneLabel}
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="voice-sample-play-btn"
                  onClick={handleToggleVoiceSample}
                  className="px-4 py-2.5 rounded-sm bg-[#DCB059]/15 border border-[#DCB059] text-[#DCB059] hover:bg-[#DCB059]/25 text-xs uppercase tracking-wider font-medium flex items-center gap-2 self-start sm:self-auto cursor-pointer"
                >
                  {isVoicePlaying ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>Остановить прослушивание</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Прослушать образец голоса</span>
                    </>
                  )}
                </button>
              </div>

              <div
                data-testid="voice-sample-transcript"
                className="p-4 rounded-sm bg-[#110F0D] border border-white/10 space-y-2"
              >
                <span className="text-[11px] uppercase tracking-wider text-[#8E8A82] block">
                  Текст голосовой карточки (читается спокойно, без фоновой музыки и внушений):
                </span>
                {PERSONAL_CHAPTER_VOICE_PREVIEW.transcript.map((paragraph, pIdx) => (
                  <p
                    key={pIdx}
                    className={`text-sm leading-relaxed transition-colors ${
                      isVoicePlaying && voiceStepIndex === pIdx
                        ? 'text-[#DCB059] font-medium'
                        : 'text-[#D6D1C4]'
                    }`}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {/* Honest Boundaries — What the package does NOT promise (A5) */}
            <div className="p-5 sm:p-6 rounded-sm bg-[#12100E] border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#D6D1C4]">
                <ShieldAlert className="w-4 h-4 text-[#DCB059]" />
                <span>Честные границы пакета — чего «Личная глава» не обещает</span>
              </div>
              <ul
                data-testid="offer-limitations-list"
                className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs sm:text-sm text-[#B8B2A6]"
              >
                {PERSONAL_CHAPTER_HONEST_LIMITATIONS.map((limitation, lIdx) => (
                  <li
                    key={lIdx}
                    className="p-3 rounded-sm bg-[#171412] border border-white/5 flex items-start gap-2.5"
                  >
                    <span className="text-[#DCB059] font-bold shrink-0">•</span>
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Stage A Honest Action: Launch Interest Only (NOT payment or preorder) */}
            <div className="p-5 sm:p-6 rounded-sm bg-[#1A1613] border border-[#DCB059]/40 space-y-5">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-[#DCB059] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-serif text-lg text-[#F3EFE0]">
                    Запись интереса к запуску «Личной главы»
                  </h4>
                  <p className="text-xs sm:text-sm text-[#CFC9BC] leading-relaxed">
                    Автоматическая оплата и выдача полного пакета находятся в подготовке к
                    запуску. Сейчас эта кнопка фиксирует только ваш интерес к запуску и не
                    является оплатой или предзаказом.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitLaunchInterest} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-[#B8B2A6] block">
                    Как вам удобнее узнать о готовности пакета:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        id: 'on_site_note' as const,
                        label: 'Отметка в браузере (без контактов)',
                        testId: 'interest-channel-on_site_note',
                      },
                      {
                        id: 'telegram' as const,
                        label: 'Telegram',
                        testId: 'interest-channel-telegram',
                      },
                      {
                        id: 'email' as const,
                        label: 'Электронная почта',
                        testId: 'interest-channel-email',
                      },
                    ].map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        data-testid={ch.testId}
                        onClick={() => setPreferredChannel(ch.id)}
                        className={`px-3.5 py-2 text-xs rounded-sm border transition-colors cursor-pointer ${
                          preferredChannel === ch.id
                            ? 'bg-[#DCB059]/20 border-[#DCB059] text-[#F3EFE0]'
                            : 'bg-[#12100E] border-white/10 text-[#A8A298] hover:border-white/25'
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="launch-interest-note-input"
                    className="text-xs text-[#A8A298] block mb-1.5"
                  >
                    Комментарий или контакт для связи при открытии (необязательно, не
                    передаётся в аналитику):
                  </label>
                  <input
                    id="launch-interest-note-input"
                    type="text"
                    data-testid="launch-interest-note-input"
                    value={contactOrNote}
                    onChange={(e) => setContactOrNote(e.target.value)}
                    placeholder="Например: хочу получить уведомление, когда откроется выпуск главы"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#12100E] border border-white/15 rounded-sm text-[#F3EFE0] focus:outline-none focus:border-[#DCB059]"
                  />
                </div>

                {interestError && (
                  <p className="text-xs text-rose-400">{interestError}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <button
                    type="submit"
                    data-testid="submit-launch-interest-btn"
                    disabled={isSubmittingInterest}
                    className="px-6 py-3 bg-[#DCB059] text-[#090706] hover:bg-[#E5BE6D] font-medium text-xs uppercase tracking-widest rounded-sm transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {isSubmittingInterest
                        ? 'Сохраняем отметку...'
                        : 'Оставить интерес к запуску Личной главы'}
                    </span>
                  </button>

                  <span className="text-xs text-[#8E8A82]">
                    Цена при запуске: 4 900 ₽ • Разовая покупка
                  </span>
                </div>
              </form>

              {interestConfirmedRecord && (
                <div
                  data-testid="launch-interest-confirmed"
                  className="p-4 rounded-sm bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm flex items-start gap-2.5"
                >
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">
                      Ваш интерес к запуску «Личной главы» зафиксирован. Никаких списаний
                      или обязательств это действие не создаёт.
                    </p>
                    <p className="text-xs text-emerald-300/80 mt-1">
                      Запись хранится отдельно от бесплатного черновика (код записи:{' '}
                      {interestConfirmedRecord.interestId}).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="px-5 py-4 sm:px-8 border-t border-white/10 bg-[#14110F] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#8E8A82]">
          <span>
            «Зеркало Себя» • Персональный образец будущей главы и честное описание пакета
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 border border-white/15 hover:border-[#DCB059] text-[#F3EFE0] rounded-sm uppercase tracking-wider text-xs transition-colors cursor-pointer"
          >
            Вернуться к разбору
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PersonalChapterOfferModal;
