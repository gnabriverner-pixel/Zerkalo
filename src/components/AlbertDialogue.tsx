import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalculationResult,
  MeetingOfMirrorsResult,
  MeetingParallel,
  MeetingDivergence,
  CodeV2Payload,
  CodeV2AlbertContext,
  StoryInputs,
  ApiResponse,
  AlbertInterpretationStance,
  AlbertOpenerRecordV1,
  UserConclusionStateV1,
} from '../types';
import { numberKnowledge } from '../data/numberKnowledge';
import {
  loadTruthState,
  saveTruthState,
  truthJourneyKey,
  hasTruthCorrections,
  TRUTH_CLEARED_EVENT,
} from '../services/albertTruthState';
import {
  Message,
  PersistedAlbertConversationV1,
  computeSourceStateVersion,
  loadAlbertConversation,
  saveAlbertConversation,
  isOpenerStale,
  isOpenerRequestInFlight,
  markOpenerRequestInFlight,
} from '../services/albertOpenerState';
import { useProtectedFetch } from './ConsentBoundary';
import {
  X,
  Send,
  Loader2,
  User,
  Compass,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  Check,
  PenLine,
  XCircle,
  BookOpen,
  ShieldAlert,
} from 'lucide-react';

export interface AlbertDialogueProps {
  context?: {
    soulNumber?: number;
    mainPattern?: string;
    mythAnchors?: {
      title?: string;
      mainImage?: string;
      innerTension?: string;
      hiddenResource?: string;
      newView?: string;
      oneStep?: string;
    };
    meetingSummary?: string;
    parallels?: MeetingParallel[];
    divergences?: MeetingDivergence[];
    reflectiveQuestion?: string;
    albertInsight?: string;
    userQuestion?: string;
    codeV2Payload?: CodeV2Payload | null;
    codeCalculation?: CalculationResult;
    codeDate?: string;
    codeReactions?: Record<string, 'confirmed' | 'rejected'>;
    storyInputs?: StoryInputs | null;
    storyResult?: NonNullable<ApiResponse['story_result']> | null;
  };
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onRequestConsent?: (retryCallback: () => void) => void;
  /**
   * Запрос на запуск короткого вступления-сопоставления от явного нажатия кнопки пользователем
   * (например, «Что это значит для моего вопроса?»). Числовой счётчик гарантирует,
   * что открытие страницы или ререндер НИКОГДА не запускают генерацию сами.
   */
  openerTriggerToken?: number;
  onReturnToCode?: () => void;
  onReturnToMyth?: () => void;
  onOpenPersonalChapterSample?: (payload: {
    stance: AlbertInterpretationStance;
    systemHypothesis: string;
    userOwnPhrase: string;
    chosenStepOrQuestion: string;
    sourceStateVersion: string;
  }) => void;
  // Backward-compatible flat props
  journeyId?: string;
  userQuestion?: string;
  onUserQuestionChange?: (question: string) => void;
  userNote?: string;
  onUserNoteChange?: (note: string) => void;
  calc?: CalculationResult | null;
  codeDate?: string;
  storyInputs?: StoryInputs | null;
  storyResult?: NonNullable<ApiResponse['story_result']> | null;
  meetingResult?: MeetingOfMirrorsResult | null;
  initialTopic?: string;
  theme?: 'light' | 'dark';
  codeV2Payload?: CodeV2Payload | null;
  codeV2Context?: CodeV2AlbertContext | null;
  codeReactions?: Record<string, 'confirmed' | 'rejected'>;
}

const PRESET_QUESTIONS = [
  'Объясни проще, о чём мой Код',
  'Проверить на моей ситуации',
  'Вот с чем я не согласен',
  'Помоги сделать следующий шаг',
];

function sanitizeClientAlbertText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\bmainPattern\b/gi, 'центральный мотив')
    .replace(/\bmain_pattern\b/gi, 'центральный мотив')
    .replace(/\bq[1-4]\b/gi, 'ответ в мифе')
    .replace(/\bcodeAnchors?\b/gi, 'опора в коде')
    .replace(/\bmythAnchors?\b/gi, 'образ мифа')
    .replace(/\balbertInsight\b/gi, 'наблюдение')
    .replace(/\binnerTension\b/gi, 'внутреннее напряжение')
    .replace(/\bhiddenResource\b/gi, 'скрытая опора')
    .replace(/\bnewView\b/gi, 'новый взгляд')
    .replace(/\bmainImage\b/gi, 'центральный образ');
}

export const AlbertDialogue: React.FC<AlbertDialogueProps> = ({
  context,
  isOpen = true,
  onOpenChange,
  onClose,
  onRequestConsent,
  openerTriggerToken = 0,
  onReturnToCode,
  onReturnToMyth,
  onOpenPersonalChapterSample,
  journeyId,
  userQuestion: propUserQuestion = '',
  userNote = '',
  onUserNoteChange,
  calc: propCalc,
  codeDate: propCodeDate = '',
  storyInputs: propStoryInputs = null,
  storyResult: propStoryResult = null,
  meetingResult = null,
  initialTopic = '',
  theme = 'dark',
  codeV2Payload: propCodeV2Payload = null,
  codeV2Context: propCodeV2Context = null,
  codeReactions = {},
}) => {
  const protectedFetch = useProtectedFetch();

  // Unify context and flat props
  const effectiveCodeV2Payload = context?.codeV2Payload ?? propCodeV2Payload ?? null;
  const effectiveCodeV2Context = effectiveCodeV2Payload?.albert_context ?? propCodeV2Context ?? null;
  const effectiveCodeReactions = context?.codeReactions ?? codeReactions ?? {};
  const effectiveCalc: CalculationResult | null =
    context?.codeCalculation ??
    propCalc ??
    effectiveCodeV2Payload?.calculation?.canonical_result ??
    (effectiveCodeV2Payload?.calculation?.five_numbers as any) ??
    null;
  const effectiveCodeDate =
    context?.codeDate || propCodeDate || effectiveCodeV2Payload?.calculation?.date || '';
  const effectiveStoryInputs = context?.storyInputs ?? propStoryInputs ?? null;
  const effectiveStoryResult = context?.storyResult ?? propStoryResult ?? null;
  const effectiveUserQuestion = (context?.userQuestion ?? propUserQuestion ?? '').trim();
  const effectiveMythAnchors =
    context?.mythAnchors ??
    (effectiveStoryResult
      ? {
          title: effectiveStoryResult.title,
          mainImage: effectiveStoryResult.mirror?.mainImage,
          innerTension: effectiveStoryResult.mirror?.innerTension,
          hiddenResource: effectiveStoryResult.mirror?.hiddenResource,
          newView: effectiveStoryResult.mirror?.newView,
          oneStep: effectiveStoryResult.one_step,
        }
      : undefined);
  const effectiveMeetingSummary = context?.meetingSummary ?? meetingResult?.summary ?? '';
  const effectiveParallels = context?.parallels ?? meetingResult?.parallels ?? [];
  const effectiveDivergences = context?.divergences ?? meetingResult?.divergences ?? [];
  const effectiveReflectiveQuestion =
    context?.reflectiveQuestion ?? meetingResult?.reflectiveQuestion ?? '';
  const effectiveAlbertInsight = context?.albertInsight ?? meetingResult?.albertInsight ?? '';
  const effectiveMainPattern = sanitizeClientAlbertText(
    context?.mainPattern ||
      effectiveCodeV2Payload?.central_motif ||
      effectiveCodeV2Payload?.synthesis?.strongest_motif ||
      ''
  );

  const currentSourceStateVersion = computeSourceStateVersion({
    codeDate: effectiveCodeDate,
    codeResult: effectiveCalc,
    codeV2Payload: effectiveCodeV2Payload,
    codeReactions: effectiveCodeReactions,
    mainPattern: effectiveMainPattern,
    storyInputs: effectiveStoryInputs,
    storyResult: effectiveStoryResult,
    mythAnchors: effectiveMythAnchors,
    userQuestion: effectiveUserQuestion,
    userNote,
    meetingSummary: effectiveMeetingSummary,
    confidenceNote: meetingResult?.confidenceNote,
    reflectiveQuestion: effectiveReflectiveQuestion,
    albertInsight: effectiveAlbertInsight,
    parallels: effectiveParallels,
    divergences: effectiveDivergences,
  });

  // Restore saved conversation on mount without triggering any network request
  const initialSavedRef = useRef<PersistedAlbertConversationV1 | null | undefined>(undefined);
  if (initialSavedRef.current === undefined) {
    initialSavedRef.current = loadAlbertConversation();
  }
  const initialSaved = initialSavedRef.current;

  const [messages, setMessages] = useState<Message[]>(() => initialSaved?.messages ?? []);
  const [savedSourceStateVersion, setSavedSourceStateVersion] = useState<string>(
    () => initialSaved?.sourceStateVersion ?? ''
  );
  const [openerRecord, setOpenerRecord] = useState<AlbertOpenerRecordV1 | null>(
    () => initialSaved?.openerRecord ?? null
  );
  const [userConclusion, setUserConclusion] = useState<UserConclusionStateV1 | null>(
    () => initialSaved?.userConclusion ?? null
  );
  const [crisisIntercepted, setCrisisIntercepted] = useState<boolean>(
    () => Boolean(initialSaved?.crisisIntercepted)
  );

  const [stance, setStance] = useState<AlbertInterpretationStance>(
    () => initialSaved?.userConclusion?.stance ?? 'confirmed'
  );
  const [userOwnPhrase, setUserOwnPhrase] = useState<string>(
    () => initialSaved?.userConclusion?.userOwnPhrase ?? ''
  );

  const [inputValue, setInputValue] = useState(initialTopic);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<
    { type: 'opener' } | { type: 'message'; text: string } | null
  >(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ownPhraseInputRef = useRef<HTMLTextAreaElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastHandledTriggerTokenRef = useRef<number>(0);
  const localInFlightRef = useRef<boolean>(false);

  const journeyKey = journeyId || truthJourneyKey(effectiveCalc, effectiveStoryResult, meetingResult);
  const truthRef = useRef<{ journey: string; state: any }>({
    journey: journeyKey,
    state: loadTruthState(journeyKey),
  });
  const truthEpochRef = useRef(0);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  if (truthRef.current.journey !== journeyKey) {
    truthRef.current = { journey: journeyKey, state: loadTruthState(journeyKey) };
  }

  useEffect(() => {
    if (isOpen) {
      truthRef.current = { journey: journeyKey, state: loadTruthState(journeyKey) };
      const stored = loadAlbertConversation();
      if (stored && stored.messages.length > 0 && messages.every((m) => m.id === 'greeting')) {
        setMessages(stored.messages);
        setSavedSourceStateVersion(stored.sourceStateVersion);
        setOpenerRecord(stored.openerRecord ?? null);
        setUserConclusion(stored.userConclusion ?? null);
        setCrisisIntercepted(Boolean(stored.crisisIntercepted));
        if (stored.userConclusion) {
          setStance(stored.userConclusion.stance);
          setUserOwnPhrase(stored.userConclusion.userOwnPhrase || '');
        }
      }
    }
  }, [isOpen, journeyKey]);

  useEffect(() => {
    const clear = () => {
      truthRef.current.state = undefined;
      truthEpochRef.current += 1;
      setMessages([]);
      setSavedSourceStateVersion('');
      setOpenerRecord(null);
      setUserConclusion(null);
      setCrisisIntercepted(false);
      setStance('confirmed');
      setUserOwnPhrase('');
      setErrorText(null);
      setLastFailedAction(null);
    };
    window.addEventListener(TRUTH_CLEARED_EVENT, clear);
    return () => window.removeEventListener(TRUTH_CLEARED_EVENT, clear);
  }, []);

  useEffect(() => {
    if (isOpen && initialTopic) {
      setInputValue(initialTopic);
    }
  }, [isOpen, initialTopic]);

  const soul = effectiveCalc?.soul || context?.soulNumber || 1;
  const path = effectiveCalc?.path || 1;
  const dir = effectiveCalc?.direction || 1;
  const expr = effectiveCalc?.expression || 1;
  const res = effectiveCalc?.result || 1;

  const soulInfo = numberKnowledge[soul];
  const pathInfo = numberKnowledge[path];

  const handleClose = useCallback(() => {
    onClose?.();
    onOpenChange?.(false);
  }, [onClose, onOpenChange]);

  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
      const t = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(t);
        window.removeEventListener('keydown', handleKeyDown);
        if (
          previousActiveElementRef.current &&
          typeof previousActiveElementRef.current.focus === 'function'
        ) {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [isOpen, handleClose]);

  // Initialize local greeting when opened and no saved conversation exists (never sends network request)
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const stored = loadAlbertConversation();
      if (stored && stored.messages.length > 0) {
        setMessages(stored.messages);
        setSavedSourceStateVersion(stored.sourceStateVersion);
        setOpenerRecord(stored.openerRecord ?? null);
        setUserConclusion(stored.userConclusion ?? null);
        setCrisisIntercepted(Boolean(stored.crisisIntercepted));
        return;
      }

      let greeting = '';
      if (hasTruthCorrections(truthRef.current.state)) {
        greeting = 'Здравствуйте. Продолжим с учётом ваших уточнений. Что сейчас важно рассмотреть?';
      } else if (effectiveReflectiveQuestion) {
        greeting = `Здравствуйте. Встреча оставила вопрос: «${sanitizeClientAlbertText(effectiveReflectiveQuestion)}». Можем начать с него или с вашей ситуации.`;
      } else if (effectiveCodeV2Context) {
        const questionPart = effectiveCodeV2Context.opening_question
          ? `\n\n${sanitizeClientAlbertText(effectiveCodeV2Context.opening_question)}`
          : '';
        greeting = `Здравствуйте. ${sanitizeClientAlbertText(effectiveCodeV2Context.opening_statement)}${questionPart}\n\nМожем проверить эту развилку на вашей реальной ситуации или разобрать то, с чем вы не согласны.`;
      } else if (effectiveCalc) {
        greeting = `Здравствуйте. Перед нами карта Кода: мотив Души ${soul} и способ действия Пути ${path}.\n\nПроверим это сочетание на конкретной задаче или разберём другую деталь?`;
      } else {
        greeting =
          'Здравствуйте. Я готов разобрать увиденное в зеркалах. Опишите конкретную ситуацию или вопрос, который хочется исследовать.';
      }
      setMessages([
        {
          id: 'greeting',
          sender: 'albert',
          text: sanitizeClientAlbertText(greeting),
          timestamp: new Date(),
        },
      ]);
    }
  }, [
    isOpen,
    messages.length,
    effectiveReflectiveQuestion,
    effectiveCalc,
    soul,
    path,
    dir,
    expr,
    soulInfo,
    pathInfo,
    effectiveCodeV2Context,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const buildContextPayload = useCallback((): Record<string, unknown> => {
    const contextPayload: Record<string, unknown> = {
      userNote,
      ...(effectiveUserQuestion ? { userQuestion: effectiveUserQuestion.slice(0, 500) } : {}),
      ...(effectiveCodeReactions && Object.keys(effectiveCodeReactions).length > 0
        ? { codeReactions: effectiveCodeReactions }
        : {}),
      ...(effectiveMainPattern ? { mainPattern: effectiveMainPattern } : {}),
      ...(effectiveStoryInputs ? { storyInputs: effectiveStoryInputs } : {}),
    };

    if (effectiveMeetingSummary || effectiveReflectiveQuestion || effectiveAlbertInsight) {
      contextPayload.meetingSummary = effectiveMeetingSummary;
      contextPayload.confidenceNote = meetingResult?.confidenceNote;
      contextPayload.centralQuestion = effectiveReflectiveQuestion;
      contextPayload.albertInsight = effectiveAlbertInsight;
      contextPayload.resonances = effectiveParallels;
      contextPayload.divergences = effectiveDivergences;
    }

    if (effectiveCalc || context?.soulNumber) {
      contextPayload.codeAnchors = {
        numbers: {
          soul: effectiveCalc?.soul ?? context?.soulNumber,
          path: effectiveCalc?.path,
          direction: effectiveCalc?.direction,
          expression: effectiveCalc?.expression,
          result: effectiveCalc?.result,
        },
        ...(effectiveMainPattern ? { keyInsight: effectiveMainPattern } : {}),
      };
    }

    if (effectiveMythAnchors || effectiveStoryResult) {
      contextPayload.mythAnchors = {
        title: effectiveMythAnchors?.title ?? effectiveStoryResult?.title,
        mainImage: effectiveMythAnchors?.mainImage ?? effectiveStoryResult?.mirror?.mainImage,
        innerTension:
          effectiveMythAnchors?.innerTension ?? effectiveStoryResult?.mirror?.innerTension,
        hiddenResource:
          effectiveMythAnchors?.hiddenResource ?? effectiveStoryResult?.mirror?.hiddenResource,
        newView: effectiveMythAnchors?.newView ?? effectiveStoryResult?.mirror?.newView,
        oneStep: effectiveMythAnchors?.oneStep ?? effectiveStoryResult?.one_step,
      };
    }

    if (effectiveCodeV2Payload) {
      contextPayload.codeV2Payload = {
        central_motif:
          effectiveCodeV2Payload.central_motif ||
          effectiveCodeV2Payload.synthesis?.strongest_motif,
        albert_context: effectiveCodeV2Payload.albert_context,
        calculation: effectiveCodeV2Payload.calculation
          ? { canonical_result: effectiveCodeV2Payload.calculation.canonical_result }
          : undefined,
        positions: Array.isArray(effectiveCodeV2Payload.positions)
          ? effectiveCodeV2Payload.positions.map((pos) => ({
              position: pos.position,
              public_name: pos.public_name,
              role: pos.role,
              energy: pos.energy,
              essence: pos.essence,
            }))
          : [],
      };
    }

    return contextPayload;
  }, [
    userNote,
    effectiveUserQuestion,
    effectiveCodeReactions,
    effectiveMainPattern,
    effectiveCodeDate,
    effectiveStoryInputs,
    effectiveMeetingSummary,
    effectiveReflectiveQuestion,
    effectiveAlbertInsight,
    meetingResult?.confidenceNote,
    effectiveParallels,
    effectiveDivergences,
    effectiveCalc,
    context?.soulNumber,
    effectiveMythAnchors,
    effectiveStoryResult,
    effectiveCodeV2Payload,
  ]);

  const sendAlbertApiRequest = useCallback(
    async (bodyPayload: Record<string, unknown>, signal: AbortSignal): Promise<Response | null> => {
      const init: RequestInit = {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      };
      const primaryRes = await protectedFetch('/api/albert/dialogue', init);
      if (primaryRes && primaryRes.status === 404) {
        return protectedFetch('/api/albert', init);
      }
      return primaryRes;
    },
    [protectedFetch]
  );

  // Explicit Short Juxtaposition Opener Request (A1 & A2)
  const executeOpenerRequest = useCallback(
    async (forceRefresh = false) => {
      if (
        isOpenerRequestInFlight(currentSourceStateVersion) ||
        localInFlightRef.current ||
        isLoading
      ) {
        return;
      }
      if (
        !forceRefresh &&
        openerRecord &&
        openerRecord.sourceStateVersion === currentSourceStateVersion
      ) {
        return;
      }

      localInFlightRef.current = true;
      markOpenerRequestInFlight(currentSourceStateVersion, true);
      setIsLoading(true);
      setErrorText(null);
      setLastFailedAction(null);

      const controller = new AbortController();
      requestRef.current = controller;

      try {
        const truthEpoch = truthEpochRef.current;
        const substantiveHistory = messages
          .filter((m) => m.id !== 'greeting')
          .map((m) => ({
            sender: m.sender,
            text: m.text,
          }));

        const res = await sendAlbertApiRequest(
          {
            actionType: 'short_juxtaposition_opener',
            sourceStateVersion: currentSourceStateVersion,
            message: '',
            history: substantiveHistory,
            context: buildContextPayload(),
            truthState: truthRef.current.state,
          },
          controller.signal
        );

        if (controller.signal.aborted) return;

        if (!res) {
          onRequestConsent?.(() => {
            void executeOpenerRequest(forceRefresh);
          });
          setIsLoading(false);
          return;
        }

        if (res.status === 403) {
          const errBody = await res.clone().json().catch(() => ({}));
          if (errBody?.code === 'consent_required') {
            onRequestConsent?.(() => {
              void executeOpenerRequest(forceRefresh);
            });
            setIsLoading(false);
            return;
          }
        }

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          const safeMessage =
            errJson?.ui?.safe_message ||
            'Не удалось собрать сопоставление. Ваши результаты и вопрос сохранены — попробуйте повторить отправку.';
          setErrorText(safeMessage);
          setLastFailedAction({ type: 'opener' });
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        if (controller.signal.aborted) return;

        if (data.truthState && truthEpoch === truthEpochRef.current) {
          truthRef.current.state = data.truthState;
          saveTruthState(journeyKey, data.truthState);
        }

        // Handle Crisis Interception (A2)
        if (
          data.status === 'crisis' ||
          data.isCrisis === true ||
          data.safetyState === 'crisis'
        ) {
          const crisisText = sanitizeClientAlbertText(
            data.response ||
              data.message ||
              'Сейчас важнее всего ваша безопасность. Пожалуйста, обратитесь за живой поддержкой: 112 (экстренная служба) или 8-800-2000-122 (бесплатная горячая линия психологической помощи).'
          );
          const crisisMsg: Message = {
            id: `crisis_${Date.now()}`,
            sender: 'albert',
            text: crisisText,
            timestamp: new Date(),
            sourceStateVersion: currentSourceStateVersion,
          };
          const nextMessages = [
            ...messages.filter((m) => m.id !== 'greeting'),
            crisisMsg,
          ];
          setCrisisIntercepted(true);
          setMessages(nextMessages);
          setSavedSourceStateVersion(currentSourceStateVersion);
          saveAlbertConversation({
            version: 1,
            sourceStateVersion: currentSourceStateVersion,
            messages: nextMessages,
            openerRecord,
            userConclusion,
            crisisIntercepted: true,
            updatedAt: new Date().toISOString(),
          });
          setIsLoading(false);
          return;
        }

        const replyTextRaw = data.response || data.message;
        if (data.status !== 'ok' || !replyTextRaw) {
          const safeMessage =
            data?.ui?.safe_message ||
            'Не удалось получить сопоставление. Ваши данные сохранены — попробуйте повторить отправку.';
          setErrorText(safeMessage);
          setLastFailedAction({ type: 'opener' });
          setIsLoading(false);
          return;
        }

        const replyText = sanitizeClientAlbertText(String(replyTextRaw));
        const nextOpenLoop = data.nextOpenLoop ?? data.next_open_loop ?? null;

        const newOpenerRecord: AlbertOpenerRecordV1 = {
          version: 1,
          sourceStateVersion: currentSourceStateVersion,
          openerText: replyText,
          nextOpenLoop: typeof nextOpenLoop === 'string' ? sanitizeClientAlbertText(nextOpenLoop) : null,
          createdAt: new Date().toISOString(),
          lensesUsed: {
            hasCode: Boolean(effectiveCalc),
            hasMyth: Boolean(effectiveMythAnchors?.mainImage || effectiveStoryResult),
            hasQuestion: Boolean(effectiveUserQuestion),
          },
        };

        const openerMsg: Message = {
          id: `opener_${Date.now()}`,
          sender: 'albert',
          text: replyText,
          timestamp: new Date(),
          isOpener: true,
          sourceStateVersion: currentSourceStateVersion,
        };

        const baseMessages = messages.filter((m) => m.id !== 'greeting');
        const nextMessages = [...baseMessages, openerMsg];

        setMessages(nextMessages);
        setOpenerRecord(newOpenerRecord);
        setSavedSourceStateVersion(currentSourceStateVersion);
        setLastFailedAction(null);
        setIsLoading(false);

        saveAlbertConversation({
          version: 1,
          sourceStateVersion: currentSourceStateVersion,
          messages: nextMessages,
          openerRecord: newOpenerRecord,
          userConclusion,
          crisisIntercepted: false,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Albert opener request failed:', err);
        setErrorText(
          'Собеседник временно недоступен. Ваши результаты и вопрос сохранены — попробуйте повторить отправку.'
        );
        setLastFailedAction({ type: 'opener' });
        setIsLoading(false);
      } finally {
        localInFlightRef.current = false;
        markOpenerRequestInFlight(currentSourceStateVersion, false);
      }
    },
    [
      currentSourceStateVersion,
      isLoading,
      openerRecord,
      messages,
      sendAlbertApiRequest,
      buildContextPayload,
      onRequestConsent,
      journeyKey,
      userConclusion,
      effectiveCalc,
      effectiveMythAnchors?.mainImage,
      effectiveStoryResult,
      effectiveUserQuestion,
    ]
  );

  // Trigger short juxtaposition opener ONLY when openerTriggerToken increments from an explicit user click
  useEffect(() => {
    if (!isOpen) return;
    if (
      openerTriggerToken &&
      openerTriggerToken > 0 &&
      openerTriggerToken !== lastHandledTriggerTokenRef.current
    ) {
      lastHandledTriggerTokenRef.current = openerTriggerToken;
      const alreadyHasCurrentOpener =
        openerRecord && openerRecord.sourceStateVersion === currentSourceStateVersion;
      if (!alreadyHasCurrentOpener && !isOpenerRequestInFlight(currentSourceStateVersion)) {
        void executeOpenerRequest(false);
      }
    }
  }, [isOpen, openerTriggerToken, openerRecord, currentSourceStateVersion, executeOpenerRequest]);

  if (!isOpen) return null;

  const handleSend = async (questionText?: string, retry = false) => {
    const text = (questionText || inputValue).trim();
    if (!text || isLoading || localInFlightRef.current) return;

    const isRetry =
      retry ||
      Boolean(
        lastFailedAction?.type === 'message' &&
          messages.length > 0 &&
          messages[messages.length - 1].sender === 'user'
      );

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date(),
      sourceStateVersion: currentSourceStateVersion,
    };

    const nextMessagesWithUser = isRetry
      ? [...messages.slice(0, -1), userMsg]
      : [...messages, userMsg];

    setMessages(nextMessagesWithUser);
    setInputValue('');
    setIsLoading(true);
    setErrorText(null);
    setLastFailedAction(null);
    localInFlightRef.current = true;

    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const truthEpoch = truthEpochRef.current;
      const historyPayload = (isRetry ? messages.slice(0, -1) : messages)
        .filter((m) => m.id !== 'greeting')
        .map((m) => ({
          sender: m.sender,
          text: m.text,
        }));

      const response = await sendAlbertApiRequest(
        {
          actionType: 'user_message',
          sourceStateVersion: currentSourceStateVersion,
          message: text,
          history: historyPayload,
          context: buildContextPayload(),
          truthState: truthRef.current.state,
        },
        controller.signal
      );

      if (controller.signal.aborted) return;

      if (!response) {
        if (!isRetry) {
          setMessages((prev) => prev.filter((message) => message.id !== userMsg.id));
        }
        setInputValue(text);
        onRequestConsent?.(() => {
          void handleSend(text, true);
        });
        setIsLoading(false);
        return;
      }

      if (response.status === 403) {
        const errBody = await response.clone().json().catch(() => ({}));
        if (errBody?.code === 'consent_required') {
          if (!isRetry) {
            setMessages((prev) => prev.filter((message) => message.id !== userMsg.id));
          }
          setInputValue(text);
          onRequestConsent?.(() => {
            void handleSend(text, true);
          });
          setIsLoading(false);
          return;
        }
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const safeMessage =
          errJson?.ui?.safe_message ||
          'Собеседник временно недоступен. Результаты остаются на странице — попробуйте повторить отправку.';
        setErrorText(safeMessage);
        setLastFailedAction({ type: 'message', text });
        setInputValue((prev) => prev || text);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      if (controller.signal.aborted) return;

      if (data.truthState && truthEpoch === truthEpochRef.current) {
        truthRef.current.state = data.truthState;
        saveTruthState(journeyKey, data.truthState);
      }

      // Handle Crisis Interception (A2)
      if (
        data.status === 'crisis' ||
        data.isCrisis === true ||
        data.safetyState === 'crisis'
      ) {
        const crisisText = sanitizeClientAlbertText(
          data.response ||
            data.message ||
            'Сейчас важнее всего ваша безопасность. Пожалуйста, обратитесь за живой поддержкой: 112 (экстренная служба) или 8-800-2000-122 (бесплатная горячая линия психологической помощи).'
        );
        const crisisMsg: Message = {
          id: `crisis_${Date.now()}`,
          sender: 'albert',
          text: crisisText,
          timestamp: new Date(),
          sourceStateVersion: currentSourceStateVersion,
        };
        const finalMessages = [...nextMessagesWithUser, crisisMsg];
        setCrisisIntercepted(true);
        setMessages(finalMessages);
        const effectiveSavedVersion = savedSourceStateVersion || currentSourceStateVersion;
        setSavedSourceStateVersion(effectiveSavedVersion);
        saveAlbertConversation({
          version: 1,
          sourceStateVersion: effectiveSavedVersion,
          messages: finalMessages.filter((m) => m.id !== 'greeting'),
          openerRecord,
          userConclusion,
          crisisIntercepted: true,
          updatedAt: new Date().toISOString(),
        });
        setIsLoading(false);
        return;
      }

      const replyTextRaw = data.response || data.message;
      if (data.status !== 'ok' || !replyTextRaw) {
        const safeMessage =
          data?.ui?.safe_message || 'Не удалось получить ответ. Попробуйте повторить отправку.';
        setErrorText(safeMessage);
        setLastFailedAction({ type: 'message', text });
        setInputValue((prev) => prev || text);
        setIsLoading(false);
        return;
      }

      const replyText = sanitizeClientAlbertText(String(replyTextRaw));
      const albertMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'albert',
        text: replyText,
        timestamp: new Date(),
        sourceStateVersion: currentSourceStateVersion,
      };

      const finalMessages = [...nextMessagesWithUser, albertMsg];
      const effectiveSavedVersion = savedSourceStateVersion || currentSourceStateVersion;
      setMessages(finalMessages);
      setSavedSourceStateVersion(effectiveSavedVersion);
      setIsLoading(false);

      saveAlbertConversation({
        version: 1,
        sourceStateVersion: effectiveSavedVersion,
        messages: finalMessages.filter((m) => m.id !== 'greeting'),
        openerRecord,
        userConclusion,
        crisisIntercepted: false,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('Albert dialogue request failed:', err);
      setErrorText(
        'Собеседник временно недоступен. Результаты остаются на странице — попробуйте повторить отправку.'
      );
      setLastFailedAction({ type: 'message', text });
      setInputValue((prev) => prev || text);
      setIsLoading(false);
    } finally {
      localInFlightRef.current = false;
    }
  };

  const handleRetry = () => {
    if (!lastFailedAction || isLoading) return;
    if (lastFailedAction.type === 'opener') {
      void executeOpenerRequest(true);
    } else if (lastFailedAction.type === 'message') {
      void handleSend(lastFailedAction.text, true);
    }
  };

  const substantiveMessages = messages.filter((m) => m.id !== 'greeting');
  const persistedSnapshotForStaleCheck: PersistedAlbertConversationV1 | null =
    savedSourceStateVersion && ( substantiveMessages.length > 0 || openerRecord )
      ? {
          version: 1,
          sourceStateVersion: savedSourceStateVersion,
          messages: substantiveMessages,
          openerRecord,
          userConclusion,
          crisisIntercepted,
          updatedAt: '',
        }
      : null;

  const isStale = isOpenerStale(persistedSnapshotForStaleCheck, currentSourceStateVersion);

  const serverAlbertMessages = substantiveMessages.filter((m) => m.sender === 'albert');
  const hasSubstantiveAlbertReply = Boolean(openerRecord) || serverAlbertMessages.length > 0;
  const latestAlbertHypothesis =
    openerRecord?.openerText ||
    (serverAlbertMessages.length > 0
      ? serverAlbertMessages[serverAlbertMessages.length - 1].text
      : effectiveMainPattern || '');

  const chosenStepOrQuestion =
    openerRecord?.nextOpenLoop ||
    effectiveReflectiveQuestion ||
    effectiveStoryResult?.one_step ||
    effectiveUserQuestion ||
    'Проверить выбранную мысль на одном конкретном эпизоде ближайших дней.';

  const hasCodeAvailable = Boolean(effectiveCalc || effectiveCodeV2Payload);
  const hasMythAvailable = Boolean(
    effectiveStoryResult || effectiveMythAnchors?.mainImage || effectiveStoryInputs
  );

  const handleSelectStance = (nextStance: AlbertInterpretationStance) => {
    setStance(nextStance);
    if (nextStance === 'confirmed' && !userOwnPhrase.trim() && latestAlbertHypothesis) {
      const firstSentence = latestAlbertHypothesis.split(/(?<=[.!?])\s+/)[0] || latestAlbertHypothesis;
      setUserOwnPhrase(firstSentence.slice(0, 280));
    } else if (nextStance === 'edited' || nextStance === 'rejected') {
      setTimeout(() => {
        ownPhraseInputRef.current?.focus();
      }, 20);
    }
  };

  const handleOpenChapterSample = () => {
    const fallbackPhrase =
      stance === 'rejected'
        ? 'Предложенная гипотеза не совпадает с моим опытом; мне важно опереться на собственный взгляд.'
        : stance === 'edited'
        ? 'Мне близка лишь часть наблюдения; в моей ситуации акцент стоит иначе.'
        : latestAlbertHypothesis.slice(0, 280) || 'Наблюдение помогает яснее увидеть мою текущую ситуацию.';

    const finalOwnPhrase = (userOwnPhrase.trim() || fallbackPhrase).slice(0, 600);
    const conclusionRecord: UserConclusionStateV1 = {
      stance,
      systemHypothesis: latestAlbertHypothesis.slice(0, 1200),
      userOwnPhrase: finalOwnPhrase,
      chosenStepOrQuestion: chosenStepOrQuestion.slice(0, 400),
      updatedAt: new Date().toISOString(),
      sourceStateVersion: currentSourceStateVersion,
    };

    setUserConclusion(conclusionRecord);
    const effectiveSavedVersion = savedSourceStateVersion || currentSourceStateVersion;
    saveAlbertConversation({
      version: 1,
      sourceStateVersion: effectiveSavedVersion,
      messages: substantiveMessages,
      openerRecord,
      userConclusion: conclusionRecord,
      crisisIntercepted,
      updatedAt: new Date().toISOString(),
    });

    onOpenPersonalChapterSample?.({
      stance,
      systemHypothesis: conclusionRecord.systemHypothesis,
      userOwnPhrase: conclusionRecord.userOwnPhrase,
      chosenStepOrQuestion: conclusionRecord.chosenStepOrQuestion,
      sourceStateVersion: currentSourceStateVersion,
    });
  };

  const isDark = theme === 'dark';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-0 sm:p-4 md:p-6 max-w-full overflow-x-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label="Диалог с Альбертом · ИИ-собеседником"
          className={`relative w-full max-w-3xl h-[100dvh] sm:h-[88vh] max-h-[100dvh] flex flex-col sm:rounded-sm shadow-2xl z-10 max-w-full overflow-x-hidden border ${
            isDark
              ? 'bg-[#0F1412] text-[#EAEAEA] border-[#2A3B33]'
              : 'bg-[#FCFAF6] text-[#1A1A1A] border-[#E8DFC8]'
          }`}
        >
          {/* Header (Service Labels Visually Separated + Return Navigation) */}
          <div
            className={`px-4 py-3 sm:px-6 sm:py-3.5 flex flex-wrap items-center justify-between gap-2 border-b shrink-0 ${
              isDark ? 'border-[#2A3B33] bg-[#141B18]' : 'border-[#EAE3D2] bg-[#F7F3EA]'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full border border-[var(--color-antique-gold)] flex items-center justify-center bg-[var(--color-antique-gold)]/10 text-[var(--color-antique-gold)] shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] tracking-[0.2em] uppercase font-sans text-[var(--color-antique-gold)]/85 truncate">
                  Собеседник по карте и мифу
                </div>
                <h3
                  data-testid="albert-header-title"
                  className="font-serif text-lg sm:text-xl font-normal truncate"
                >
                  Альберт · ИИ-собеседник
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onReturnToCode && hasCodeAvailable && (
                <button
                  type="button"
                  data-testid="albert-return-to-code-btn"
                  onClick={onReturnToCode}
                  className={`min-h-[36px] px-3 py-1.5 text-xs uppercase tracking-wider rounded-xs border flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none ${
                    isDark
                      ? 'border-[#2A3B33] text-stone-300 hover:text-white hover:border-[var(--color-antique-gold)]/60 bg-[#0F1412]'
                      : 'border-[#EAE3D2] text-stone-700 hover:text-stone-950 hover:border-[var(--color-antique-gold)] bg-white'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>К Коду</span>
                </button>
              )}

              {onReturnToMyth && hasMythAvailable && (
                <button
                  type="button"
                  data-testid="albert-return-to-myth-btn"
                  onClick={onReturnToMyth}
                  className={`min-h-[36px] px-3 py-1.5 text-xs uppercase tracking-wider rounded-xs border flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none ${
                    isDark
                      ? 'border-[#2A3B33] text-stone-300 hover:text-white hover:border-[var(--color-antique-gold)]/60 bg-[#0F1412]'
                      : 'border-[#EAE3D2] text-stone-700 hover:text-stone-950 hover:border-[var(--color-antique-gold)] bg-white'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>К Мифу</span>
                </button>
              )}

              <button
                ref={closeButtonRef}
                type="button"
                onClick={handleClose}
                aria-label="Закрыть диалог"
                className={`min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-full transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none ${
                  isDark
                    ? 'text-stone-400 hover:text-white hover:bg-[#1A2621]'
                    : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Formula & Action Context Strip (Separated Service Metadata) */}
          <div
            className={`px-4 sm:px-6 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tracking-wider uppercase shrink-0 ${
              isDark
                ? 'border-[#2A3B33] bg-[#111A16] text-[#A3B8AD]'
                : 'border-[#EAE3D2] bg-white text-[var(--color-muted)]'
            }`}
          >
            {effectiveCalc ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>Душа: {soul}</span>
                <span>Путь: {effectiveCalc.pathComposite || path}</span>
                <span>Направление: {dir}</span>
                <span>Итог: {res}</span>
              </div>
            ) : (
              <span>Пространство диалога вокруг вашего вопроса</span>
            )}

            {!crisisIntercepted && (hasCodeAvailable || hasMythAvailable) && (
              <button
                type="button"
                data-testid="albert-trigger-opener-btn"
                disabled={isLoading || isOpenerRequestInFlight(currentSourceStateVersion)}
                onClick={() => void executeOpenerRequest(true)}
                className="px-2.5 py-1 rounded-xs border border-[var(--color-antique-gold)]/40 bg-[var(--color-antique-gold)]/10 hover:bg-[var(--color-antique-gold)]/20 text-[var(--color-antique-gold)] text-[11px] font-sans uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none"
              >
                <Sparkles className="w-3 h-3" />
                <span>
                  {isStale || openerRecord
                    ? 'Обновить сопоставление для новых данных'
                    : 'Сопоставить результаты с моим вопросом'}
                </span>
              </button>
            )}
          </div>

          {/* Stale Opener Banner (A2) */}
          {isStale && !crisisIntercepted && (
            <div
              data-testid="albert-stale-state-banner"
              className={`px-4 sm:px-6 py-3 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm shrink-0 ${
                isDark
                  ? 'bg-amber-950/35 border-amber-700/40 text-amber-100'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <span>
                Исходные данные (вопрос, Код или Миф) изменились. Ответы выше относятся к прежнему состоянию.
              </span>
              <button
                type="button"
                data-testid="albert-refresh-stale-opener-btn"
                disabled={isLoading || isOpenerRequestInFlight(currentSourceStateVersion)}
                onClick={() => void executeOpenerRequest(true)}
                className="px-3.5 py-1.5 rounded-xs bg-[var(--color-antique-gold)] text-gray-950 font-sans text-xs font-semibold uppercase tracking-wider hover:bg-[#D9B770] disabled:opacity-40 transition-colors shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none"
              >
                Собрать новое сопоставление
              </button>
            </div>
          )}

          {/* Messages & Conclusion Scrollable Container (A3: overflow-y-auto overscroll-contain) */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain max-w-full overflow-x-hidden px-4 py-5 sm:p-6 space-y-5">
            {/* Section 4: AI Persona Disclosure shown before the first message near the start of the dialogue */}
            <div
              data-testid="albert-ai-disclosure"
              className={`px-4 py-3 rounded-lg border text-xs sm:text-sm leading-relaxed ${
                isDark
                  ? 'bg-[#121916] border-[#2A3B33] text-[#B8C7BF]'
                  : 'bg-[#F7F3EA] border-[#E8DFC8] text-[#4A463F]'
              }`}
            >
              Альберт — ИИ-собеседник «Зеркала». Имя и образ вымышлены; ваши смыслы остаются вашими.
            </div>

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col max-w-full ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 px-1 text-xs font-mono uppercase tracking-wider opacity-70">
                  {msg.sender === 'albert' ? (
                    <span className="text-[var(--color-antique-gold)]">Альберт · ИИ-собеседник</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>Вы</span>
                    </span>
                  )}
                </div>

                <div
                  data-testid={
                    msg.sender === 'albert' ? 'albert-message-text' : 'user-message-text'
                  }
                  style={{
                    fontSize: msg.sender === 'albert' ? '20px' : '16px',
                    lineHeight: msg.sender === 'albert' ? 1.6 : 1.5,
                  }}
                  className={`w-full max-w-full sm:max-w-[88%] p-4 sm:p-5 rounded-xl whitespace-pre-line break-words shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-[var(--color-antique-gold)] text-white font-sans text-[16px] leading-[1.5]'
                      : isDark
                      ? 'bg-[#141C18] border border-[#2A3B33] text-[#EAEAEA] font-serif text-[20px] leading-[1.6]'
                      : 'bg-white border border-[#E8DFC8] text-[#1A1A1A] font-serif text-[20px] leading-[1.6]'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 text-xs tracking-wider uppercase font-sans text-[var(--color-antique-gold)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Альберт формулирует ответ...</span>
              </div>
            )}

            {/* Crisis Emergency Support Banner (A2) */}
            {crisisIntercepted && (
              <div
                data-testid="albert-crisis-banner"
                role="alert"
                className={`p-5 rounded-sm border space-y-3 text-sm leading-relaxed ${
                  isDark
                    ? 'bg-red-950/40 border-red-700/50 text-red-100'
                    : 'bg-red-50 border-red-300 text-red-950'
                }`}
              >
                <div className="flex items-center gap-2.5 font-semibold text-base">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-red-400" />
                  <span>Сейчас важнее всего ваша безопасность и живая поддержка</span>
                </div>
                <p>
                  Пожалуйста, не оставайтесь с этим в одиночестве. Обратитесь к людям, которые могут помочь прямо сейчас:
                </p>
                <ul className="space-y-1 font-mono text-xs sm:text-sm">
                  <li>• 112 — единая экстренная служба</li>
                  <li>• 8-800-2000-122 — бесплатная круглосуточная линия психологической помощи</li>
                  <li>• +7 (495) 989-50-50 — горячая линия психологической помощи ЦЭПП МЧС России</li>
                </ul>
              </div>
            )}

            {/* Error Banner with Explicit Retry (A2) */}
            {errorText && (
              <div
                role="alert"
                className={`p-4 rounded-sm border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm ${
                  isDark
                    ? 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[var(--color-antique-gold)]" />
                  <span>{errorText}</span>
                </div>
                {lastFailedAction && (
                  <button
                    type="button"
                    data-testid="albert-retry-btn"
                    onClick={handleRetry}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-sans uppercase tracking-wider rounded-sm bg-[var(--color-antique-gold)]/20 hover:bg-[var(--color-antique-gold)]/30 text-[var(--color-antique-gold)] border border-[var(--color-antique-gold)]/40 transition-colors shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Повторить отправку</span>
                  </button>
                )}
              </div>
            )}

            {/* User Conclusion & Personal Chapter Sample Bridge Panel (A4) */}
            {hasSubstantiveAlbertReply && !crisisIntercepted && (
              <section
                data-testid="albert-conclusion-panel"
                aria-label="Ваш вывод из разговора"
                className={`p-5 sm:p-6 rounded-xl border space-y-4 ${
                  isDark
                    ? 'bg-[#121A16] border-[#2A3B33] text-stone-200'
                    : 'bg-[#F7F3EA] border-[#E8DFC8] text-stone-900'
                }`}
              >
                <div className="space-y-1">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--color-antique-gold)] block">
                    Фиксация смысла · Свобода несогласия
                  </span>
                  <h4 className="font-serif text-lg sm:text-xl font-normal">
                    Ваш вывод из разговора
                  </h4>
                  <p className="text-xs sm:text-sm opacity-80 leading-relaxed">
                    Согласие с гипотезой не обязательно. Отметьте, как вы относитесь к наблюдению, и запишите вывод своими словами.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="albert-stance-confirm-btn"
                    onClick={() => handleSelectStance('confirmed')}
                    aria-pressed={stance === 'confirmed'}
                    className={`px-3.5 py-2 rounded-xs text-xs uppercase tracking-wider border flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none ${
                      stance === 'confirmed'
                        ? 'bg-[var(--color-antique-gold)] text-gray-950 border-[var(--color-antique-gold)] font-semibold'
                        : isDark
                        ? 'border-[#2A3B33] text-stone-300 hover:border-[var(--color-antique-gold)]/50'
                        : 'border-[#E8DFC8] text-stone-700 bg-white hover:border-[var(--color-antique-gold)]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Похоже</span>
                  </button>

                  <button
                    type="button"
                    data-testid="albert-stance-edit-btn"
                    onClick={() => handleSelectStance('edited')}
                    aria-pressed={stance === 'edited'}
                    className={`px-3.5 py-2 rounded-xs text-xs uppercase tracking-wider border flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none ${
                      stance === 'edited'
                        ? 'bg-[var(--color-antique-gold)] text-gray-950 border-[var(--color-antique-gold)] font-semibold'
                        : isDark
                        ? 'border-[#2A3B33] text-stone-300 hover:border-[var(--color-antique-gold)]/50'
                        : 'border-[#E8DFC8] text-stone-700 bg-white hover:border-[var(--color-antique-gold)]'
                    }`}
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    <span>Уточнить своими словами</span>
                  </button>

                  <button
                    type="button"
                    data-testid="albert-stance-reject-btn"
                    onClick={() => handleSelectStance('rejected')}
                    aria-pressed={stance === 'rejected'}
                    className={`px-3.5 py-2 rounded-xs text-xs uppercase tracking-wider border flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none ${
                      stance === 'rejected'
                        ? 'bg-[var(--color-antique-gold)] text-gray-950 border-[var(--color-antique-gold)] font-semibold'
                        : isDark
                        ? 'border-[#2A3B33] text-stone-300 hover:border-[var(--color-antique-gold)]/50'
                        : 'border-[#E8DFC8] text-stone-700 bg-white hover:border-[var(--color-antique-gold)]'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Не подходит</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="albert-user-own-phrase"
                    className="block text-xs uppercase tracking-wider opacity-75"
                  >
                    Ваша собственная формулировка или поправка
                  </label>
                  <textarea
                    id="albert-user-own-phrase"
                    ref={ownPhraseInputRef}
                    data-testid="albert-user-own-phrase-input"
                    rows={2}
                    maxLength={600}
                    value={userOwnPhrase}
                    onChange={(e) => setUserOwnPhrase(e.target.value)}
                    placeholder={
                      stance === 'rejected'
                        ? 'Напишите, как ситуация выглядит на самом деле с вашей стороны...'
                        : stance === 'edited'
                        ? 'Уточните мысль своими словами: что здесь правда, а что лишнее...'
                        : 'Запишите главную мысль своими словами (или оставьте близкую формулировку)...'
                    }
                    className={`w-full rounded-lg border p-3 text-sm sm:text-base leading-relaxed focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none ${
                      isDark
                        ? 'bg-[#0B100E] border-[#2A3B33] text-stone-100 placeholder:text-stone-500'
                        : 'bg-white border-[#E8DFC8] text-stone-900 placeholder:text-stone-400'
                    }`}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs opacity-70">
                    Вывод сохранится в вашей сессии и ляжет в основу персонального образца главы.
                  </span>
                  <button
                    type="button"
                    data-testid="albert-open-chapter-sample-btn"
                    onClick={handleOpenChapterSample}
                    className="px-5 py-2.5 rounded-xs bg-[var(--color-antique-gold)] text-gray-950 font-sans text-xs font-semibold uppercase tracking-wider hover:bg-[#D9B770] transition-colors flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Собрать персональный образец главы</span>
                  </button>
                </div>
              </section>
            )}

            {onUserNoteChange && messages.some((m) => m.sender === 'user') && (
              <label className="block space-y-2 text-sm text-stone-300 font-sans">
                <span>Что я хочу оставить себе</span>
                <textarea
                  aria-label="Моя мысль после разговора"
                  value={userNote}
                  maxLength={2000}
                  onChange={(e) => onUserNoteChange(e.target.value)}
                  rows={2}
                  placeholder="Своими словами: что стало яснее или с чем я не согласен"
                  className="w-full rounded border border-white/20 bg-black/20 p-3 text-[16px] text-inherit focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none"
                />
                <span className="block text-xs">
                  Эта заметка останется в текущем исследовании. Сохранение на устройстве — в «Моём зеркале».
                </span>
              </label>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Prompts */}
          <div
            className={`px-4 sm:px-6 py-2.5 border-t overflow-x-auto flex gap-2 no-scrollbar shrink-0 ${
              isDark ? 'border-[#2A3B33] bg-[#111A16]' : 'border-[#EAE3D2] bg-[#FAF8F5]'
            }`}
          >
            {PRESET_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  setInputValue(
                    q === 'Объясни проще, о чём мой Код'
                      ? 'Я ничего не понял, объясни внятно и простыми словами, о чём мой Код.'
                      : q === 'Вот с чем я не согласен'
                      ? 'Не согласен с тем, что '
                      : q === 'Проверить на моей ситуации'
                      ? 'В моей ситуации '
                      : 'Мне важно сделать следующий шаг в '
                  )
                }
                disabled={isLoading}
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-all text-left disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none ${
                  isDark
                    ? 'border-[#2A3B33] text-[#A3B8AD] hover:border-[var(--color-antique-gold)] hover:text-white'
                    : 'border-[#EAE3D2] text-stone-600 hover:border-[var(--color-antique-gold)] hover:text-stone-900 bg-white'
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div
            className={`p-3.5 sm:p-5 border-t shrink-0 ${
              isDark ? 'border-[#2A3B33] bg-[#141B18]' : 'border-[#EAE3D2] bg-[#F7F3EA]'
            }`}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="flex items-center gap-2.5 sm:gap-3"
            >
              <input
                type="text"
                style={{ fontSize: '16px' }}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  meetingResult || hasMythAvailable
                    ? 'Задайте вопрос Альберту о вашей карте и мифе...'
                    : 'Задайте вопрос Альберту о вашей карте...'
                }
                className={`flex-1 min-w-0 px-4 py-3 rounded-xl border font-sans text-[16px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                  isDark
                    ? 'bg-[#0F1412] border-[#2A3B33] text-white placeholder-stone-500 focus:border-[var(--color-antique-gold)]'
                    : 'bg-white border-[#E8DFC8] text-stone-900 placeholder-stone-400 focus:border-[var(--color-antique-gold)]'
                }`}
              />
              <button
                type="submit"
                aria-label="Отправить сообщение"
                disabled={!inputValue.trim() || isLoading}
                className="min-h-[48px] px-4 sm:px-5 py-3 bg-[var(--color-antique-gold)] text-white hover:bg-[#B8934C] disabled:opacity-30 rounded-xl transition-colors flex items-center justify-center shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AlbertDialogue;
