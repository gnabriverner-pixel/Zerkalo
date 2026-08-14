import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  Sparkles, 
  Compass, 
  Feather, 
  Flame, 
  Key, 
  Anchor, 
  BookOpen, 
  CheckCircle2, 
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  X,
  Maximize2,
  HelpCircle,
  Eye
} from 'lucide-react';
import { StoryInputs, ApiResponse } from '../types';

interface MythTimelineProps {
  inputs: StoryInputs;
  result?: ApiResponse['story_result'] | null;
  currentStep?: number;
  mode?: 'interactive' | 'result';
}

interface TimelineEvent {
  id: string;
  phase: string;
  timeEra: string;
  title: string;
  subtitle: string;
  alchemicalStage: string;
  icon: React.ReactNode;
  color: string;
  glowColor: string;
  accentBg: string;
  userContent?: string;
  insight: string;
  detailedDescription: string;
  alchemicalMeaning: string;
  bodyFocus: string;
  keyQuestion: string;
  promptQuestion?: string;
  status: 'completed' | 'active' | 'future';
}

export function MythTimeline({ inputs, result, currentStep = 0, mode = 'result' }: MythTimelineProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>('stage-tension');
  const [modalEvent, setModalEvent] = useState<TimelineEvent | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | 'past' | 'present' | 'future'>('all');

  // Handle ESC key for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalEvent(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const events: TimelineEvent[] = [
    {
      id: 'stage-tension',
      phase: 'I. Исток',
      timeEra: 'Прошлое / Накопленный опыт',
      title: 'Зона Напряжения и Зов',
      subtitle: 'Точка входа в личный миф',
      alchemicalStage: 'Nigredo · Исходная темнота',
      icon: <Flame className="w-4 h-4" />,
      color: '#B2675E', // Тёплый терракот
      glowColor: 'rgba(178, 103, 94, 0.35)',
      accentBg: 'rgba(178, 103, 94, 0.12)',
      userContent: inputs.q1 || (result?.mirror?.innerTension ?? ''),
      insight: 'Каждое внутреннее напряжение — это запертый потенциал, ищущий форму для высвобождения. Миф начинается именно там, где прежний порядок перестал работать.',
      detailedDescription: 'В алхимической традиции этап Nigredo (Чернота) знаменует распад старых иллюзий и обнажение истинного сырья души. Напряжение, дискомфорт или усталость — это не сбой системы, а зов к пересборке. Здесь завязывается главный конфликт личной драмы, без которого невозможно дальнейшее преображение.',
      alchemicalMeaning: 'Очищение через осознание границы своих прежних возможностей. Превращение слепого сопротивления в осознанное сырьё для поиска.',
      bodyFocus: 'Ощущение плотности, сжатия или тяжести в теле, требующее свободного выдоха и внимания.',
      keyQuestion: 'Какое внутреннее напряжение долгое время оставалось без признания и имени?',
      promptQuestion: 'Что внутри требовало внимания',
      status: inputs.q1 || result ? 'completed' : currentStep === 1 ? 'active' : 'future'
    },
    {
      id: 'stage-image',
      phase: 'II. Проявление',
      timeEra: 'Символическое Пространство',
      title: 'Встреча с Образом',
      subtitle: 'Материализация внутреннего состояния',
      alchemicalStage: 'Albedo · Кристаллизация формы',
      icon: <Compass className="w-4 h-4" />,
      color: '#7C9082', // Приглушенный шалфей / оливковый
      glowColor: 'rgba(124, 144, 130, 0.35)',
      accentBg: 'rgba(124, 144, 130, 0.12)',
      userContent: inputs.q2 || (result?.mirror?.mainImage ?? ''),
      insight: 'Бессознательное говорит на языке метафор. Образ делает невидимый эмоциональный ландшафт осязаемым и безопасным для исследования.',
      detailedDescription: 'Этап Albedo (Белизна) приносит первую ясность и структурирование. Бесформенное чувство обретает точный символ — будь то маяк в тумане, запертый сундук или спящий дракон. Символ позволяет отделить себя от проблемы и взглянуть на неё глазами исследователя и сказителя.',
      alchemicalMeaning: 'Кристаллизация смутных предчувствий в визуальный архетип, открывающий диалог с бессознательным.',
      bodyFocus: 'Перемещение фокуса внимания из мыслей во внутреннее зрительное пространство и дыхание.',
      keyQuestion: 'Если бы это состояние было живым существом или пейзажем, как бы оно выглядело?',
      promptQuestion: 'Символический образ состояния',
      status: inputs.q2 || result ? 'completed' : currentStep === 2 ? 'active' : 'future'
    },
    {
      id: 'stage-vitality',
      phase: 'III. Память Живости',
      timeEra: 'Внутренний Ресурс / Прошлый Опыт',
      title: 'Точка Подлинности и Силы',
      subtitle: 'Воспоминание о свободном течении энергии',
      alchemicalStage: 'Citrinitas · Золотой проблеск',
      icon: <Sparkles className="w-4 h-4" />,
      color: '#D4AF37', // Античное золото
      glowColor: 'rgba(212, 175, 55, 0.35)',
      accentBg: 'rgba(212, 175, 55, 0.12)',
      userContent: inputs.q3 || (result?.mirror?.newView ?? ''),
      insight: 'Память о моментах ясности доказывает: состояние гармонии не нужно изобретать заново — оно уже записано в вашем опыте и ждёт реактивации.',
      detailedDescription: 'Стадия Citrinitas (Желтизна/Злато) — это пробуждение внутренней мудрости и озарение. Мы обращаемся к тем фрагментам вашей личной истории, где энергия текла беспрепятственно: моменты игры, полета мысли, глубокого покоя или искренней связи. Это доказательство того, что вы уже обладаете знанием о своей целостности.',
      alchemicalMeaning: 'Реактивация скрытого золотого запаса психики, воспоминание о подлинном внутреннем эталоне.',
      bodyFocus: 'Тепло в груди, расправление плеч, ощущение легкости в позвоночнике.',
      keyQuestion: 'Где и когда вы переживали пик своей естественной подлинности и спокойной силы?',
      promptQuestion: 'Где вы чувствовали себя живее',
      status: inputs.q3 || result ? 'completed' : currentStep === 3 ? 'active' : 'future'
    },
    {
      id: 'stage-alchemy',
      phase: 'IV. Трансформация',
      timeEra: 'Алхимический Переход',
      title: 'Искомое Качество (Ключ)',
      subtitle: 'Недостающий элемент для алхимии мифа',
      alchemicalStage: 'Rubedo · Преображение',
      icon: <Key className="w-4 h-4" />,
      color: '#8A9EA7', // Сумеречно-сизый
      glowColor: 'rgba(138, 158, 167, 0.35)',
      accentBg: 'rgba(138, 158, 167, 0.12)',
      userContent: inputs.q4 || (result?.mirror?.hiddenResource ?? ''),
      insight: 'То, чего кажется недостающим, становится направлением роста. Признание дефицита открывает шлюз для новой энергии.',
      detailedDescription: 'Кульминация внутренней алхимии — Rubedo (Краснота). В этой точке соединяются противоположности: темнота напряжения и золото опыта синтезируются в новое качество. Определение того, чего не хватало (доверия, тишины, смелости, права на ошибку), превращается в ключ, отпирающий движение вперед.',
      alchemicalMeaning: 'Финальный синтез элементов в Философский Камень личного выбора — обретение нового взгляда.',
      bodyFocus: 'Глубокий вдох в центр живота, чувство центрированности и готовности к выбору.',
      keyQuestion: 'Какое единственное качество или разрешение сейчас меняет всё восприятие пути?',
      promptQuestion: 'Качество, которого не хватает',
      status: inputs.q4 || result ? 'completed' : currentStep === 4 ? 'active' : 'future'
    },
    ...(result ? [
      {
        id: 'stage-grounding',
        phase: 'V. Настоящее',
        timeEra: 'Здесь и Сейчас',
        title: 'Опорный Шаг',
        subtitle: 'Заземление мифа в физическое действие',
        alchemicalStage: 'Actio · Воплощение в материю',
        icon: <Anchor className="w-4 h-4" />,
        color: '#A3B8AD', // Светлый нефрит
        glowColor: 'rgba(163, 184, 173, 0.35)',
        accentBg: 'rgba(163, 184, 173, 0.12)',
        userContent: result.one_step,
        insight: 'Без простого физического действия сказка остаётся лишь грёзой. Микро-шаг закрепляет изменение в нейронных путях и теле.',
        detailedDescription: 'Миф обретает плоть только через земное действие. Этап Actio переводит тонкую энергию осознания в осязаемый микро-шаг: прогулка без телефона, честное письмо, пауза перед ответом, порядок на рабочем столе. Одно маленькое действие способно перенаправить всё русло жизненного сюжета.',
        alchemicalMeaning: 'Якорение архетипической энергии в материю повседневности.',
        bodyFocus: 'Ощущение стоп на земле, уверенное прикосновение к физическим предметам.',
        keyQuestion: 'Какое простое, выполнимое за 10 минут действие подтвердит ваше решение сегодня?',
        promptQuestion: 'Одно действие сегодня',
        status: 'completed' as const
      },
      {
        id: 'stage-future',
        phase: 'VI. Будущее',
        timeEra: 'Горизонт Дней & Недель',
        title: 'Интеграция и Вопрос',
        subtitle: 'Непрерывное разворачивание личной истории',
        alchemicalStage: 'Continuum · Живой процесс',
        icon: <BookOpen className="w-4 h-4" />,
        color: '#E0D8C3', // Слоновая кость / папирус
        glowColor: 'rgba(224, 216, 195, 0.35)',
        accentBg: 'rgba(224, 216, 195, 0.12)',
        userContent: result.journal_question,
        insight: 'Вопрос сильнее готового ответа: он удерживает сознание в состоянии открытости и привлекает нужные синхроничности.',
        detailedDescription: 'Этап Continuum оставляет финал открытым. Личный миф не заканчивается точкой — он разворачивается спиралью. Заданный вопрос для саморефлексии работает как компас в фоновом режиме мышления, настраивая восприятие на обнаружение новых возможностей и знаков на пути.',
        alchemicalMeaning: 'Поддержание огня осознанности в бесконечном круге самопознания.',
        bodyFocus: 'Пространство и свежесть во взгляде, открытость новому опыту.',
        keyQuestion: 'С каким вопросом вы вступаете в следующий отрезок своего жизненного пути?',
        promptQuestion: 'Вопрос для дневника',
        status: 'completed' as const
      }
    ] : [])
  ];

  const filteredEvents = events.filter(e => {
    if (viewFilter === 'past') return e.id === 'stage-tension' || e.id === 'stage-vitality';
    if (viewFilter === 'present') return e.id === 'stage-image' || e.id === 'stage-alchemy' || e.id === 'stage-grounding';
    if (viewFilter === 'future') return e.id === 'stage-future' || e.id === 'stage-grounding';
    return true;
  });

  const selectedEvent = events.find(e => e.id === selectedEventId) || events[0];

  // Navigate between events in modal
  const handleModalPrev = () => {
    if (!modalEvent) return;
    const idx = events.findIndex(e => e.id === modalEvent.id);
    const prevIdx = (idx - 1 + events.length) % events.length;
    setModalEvent(events[prevIdx]);
    setSelectedEventId(events[prevIdx].id);
  };

  const handleModalNext = () => {
    if (!modalEvent) return;
    const idx = events.findIndex(e => e.id === modalEvent.id);
    const nextIdx = (idx + 1) % events.length;
    setModalEvent(events[nextIdx]);
    setSelectedEventId(events[nextIdx].id);
  };

  // If in step-by-step interactive questionnaire mode:
  if (mode === 'interactive') {
    return (
      <div className="w-full my-6 p-4 rounded-sm bg-[#111A16]/60 border border-[#2A3B33]">
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-2 text-[#A3B8AD]">
            <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="tracking-widest uppercase font-mono text-[10px]">Шкала Времени Мифа</span>
          </div>
          <span className="text-gray-500 font-mono text-[10px]">
            Шаг {currentStep} из 4 · Нажмите на маркер для деталей
          </span>
        </div>

        {/* Linear progress track */}
        <div className="relative w-full h-1.5 bg-[#1A2621] rounded-full overflow-hidden mb-4">
          <motion.div 
            className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-[#B2675E] via-[#7C9082] to-[#D4AF37]"
            initial={{ width: 0 }}
            animate={{ width: `${(Math.max(1, currentStep) / 4) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Milestone interactive buttons */}
        <div className="grid grid-cols-4 gap-2">
          {events.slice(0, 4).map((evt, idx) => {
            const isDone = Boolean(evt.userContent);
            const isCurr = currentStep === idx + 1;
            return (
              <button
                type="button"
                key={evt.id} 
                onClick={() => setModalEvent(evt)}
                title="Нажмите, чтобы открыть подробное описание события"
                className={`p-2 rounded-xs border text-left transition-all duration-300 cursor-pointer group hover:scale-[1.02] ${
                  isCurr 
                    ? 'bg-[#1A2621] border-[#A3B8AD] shadow-[0_0_12px_rgba(163,184,173,0.15)]' 
                    : isDone 
                      ? 'bg-[#111A16] border-[#2A3B33] text-gray-400 hover:border-[#4A5D53]' 
                      : 'bg-transparent border-transparent opacity-50 text-gray-600 hover:opacity-80'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span 
                      className="w-2 h-2 rounded-full transition-transform group-hover:scale-125" 
                      style={{ backgroundColor: evt.color }} 
                    />
                    <span className="text-[9px] uppercase tracking-wider font-mono truncate">{evt.phase}</span>
                  </div>
                  <Eye className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-[#A3B8AD] transition-opacity" />
                </div>
                <div className="text-[11px] font-serif truncate text-[#EAEAEA]">
                  {evt.title.split(' ')[0]}
                </div>
              </button>
            );
          })}
        </div>

        {/* Modal Window for Details */}
        <TimelineDetailModal 
          event={modalEvent} 
          onClose={() => setModalEvent(null)} 
          onPrev={handleModalPrev}
          onNext={handleModalNext}
        />
      </div>
    );
  }

  // Full Result View Timeline
  return (
    <div className="w-full my-8 flex flex-col bg-[#111A16] border border-[#2A3B33] rounded-sm p-6 sm:p-8 relative overflow-hidden">
      {/* Subtle background glow */}
      <div 
        className="absolute -right-24 -top-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-10"
        style={{ backgroundColor: selectedEvent.color }}
      />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#2A3B33]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#A3B8AD]">
            <Clock className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-xs uppercase tracking-widest font-mono">Хронология Личного Мифа</span>
          </div>
          <h3 className="font-serif text-2xl text-[#F4F4F4]">
            Шкала Времени: От Истока к Трансформации
          </h3>
          <p className="font-sans text-xs text-gray-400 max-w-xl">
            Кликните на любой маркер хроники, чтобы открыть полное описание этапа в модальном окне или переключайтесь между ними.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 bg-[#1A2621] p-1 rounded-sm border border-[#2A3B33] self-start sm:self-auto shrink-0">
          {(['all', 'past', 'present', 'future'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setViewFilter(f)}
              className={`px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-xs transition-all ${
                viewFilter === f 
                  ? 'bg-[#A3B8AD] text-[#0F1412] font-semibold' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {f === 'all' ? 'Весь путь' : f === 'past' ? 'Истоки' : f === 'present' ? 'Настоящее' : 'Горизонт'}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Horizontal / Vertical Timeline Stream */}
      <div className="my-8">
        <div className="relative flex flex-col md:flex-row items-stretch justify-between gap-3">
          
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-7 left-8 right-8 h-0.5 bg-gradient-to-r from-[#B2675E] via-[#D4AF37] to-[#A3B8AD] opacity-30 z-0" />

          {filteredEvents.map((evt) => {
            const isSelected = selectedEventId === evt.id;
            return (
              <div
                key={evt.id}
                className="relative z-10 flex-1 flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEventId(evt.id);
                  }}
                  className={`w-full text-left p-3.5 rounded-sm border transition-all duration-300 cursor-pointer flex flex-col justify-between group flex-1 ${
                    isSelected
                      ? 'bg-[#1A2621] border-[#A3B8AD] shadow-[0_0_20px_rgba(163,184,173,0.12)]'
                      : 'bg-[#111A16]/90 border-[#2A3B33] hover:border-[#4A5D53] hover:bg-[#16221D]'
                  }`}
                >
                  {/* Milestone Node Badge */}
                  <div className="flex items-center justify-between w-full mb-3">
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEventId(evt.id);
                        setModalEvent(evt);
                      }}
                      title="Кликните для детального разбора в окне"
                      className="w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 hover:scale-110 shadow-sm"
                      style={{ 
                        borderColor: evt.color, 
                        backgroundColor: isSelected ? evt.color : evt.accentBg,
                        color: isSelected ? '#0F1412' : evt.color
                      }}
                    >
                      {evt.icon}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-gray-500 group-hover:text-gray-300">
                        {evt.phase}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 mb-2">
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">
                      {evt.timeEra.split('/')[0]}
                    </div>
                    <div className={`font-serif text-sm font-medium transition-colors ${
                      isSelected ? 'text-[#F4F4F4]' : 'text-gray-300'
                    }`}>
                      {evt.title}
                    </div>
                  </div>

                  {/* Marker Modal Trigger Link */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEventId(evt.id);
                      setModalEvent(evt);
                    }}
                    className="flex items-center gap-1 text-[10px] font-mono text-[#A3B8AD] hover:text-white pt-2 border-t border-[#2A3B33]/40 mt-1"
                  >
                    <Maximize2 className="w-2.5 h-2.5" />
                    <span>Подробнее</span>
                  </div>

                  {/* Progress ping dot */}
                  {isSelected && (
                    <motion.div 
                      layoutId="activeTimelineGlow"
                      className="absolute -bottom-1 left-4 right-4 h-0.5 rounded-full"
                      style={{ backgroundColor: evt.color }}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Event Deep Dive Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedEvent.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="p-6 rounded-sm bg-[#16221D] border border-[#2A3B33] space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#2A3B33]/60">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setModalEvent(selectedEvent)}
                title="Нажмите на маркер, чтобы открыть подробное модальное окно"
                className="w-10 h-10 rounded-full flex items-center justify-center border cursor-pointer hover:scale-105 transition-transform"
                style={{ 
                  borderColor: selectedEvent.color, 
                  backgroundColor: selectedEvent.accentBg, 
                  color: selectedEvent.color 
                }}
              >
                {selectedEvent.icon}
              </button>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#A3B8AD]">
                  {selectedEvent.phase} · {selectedEvent.timeEra}
                </span>
                <h4 className="font-serif text-xl text-[#F4F4F4]">
                  {selectedEvent.title}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider border border-[#2A3B33] bg-[#111A16] text-[#D4AF37]">
                {selectedEvent.alchemicalStage}
              </span>
              <button
                type="button"
                onClick={() => setModalEvent(selectedEvent)}
                className="p-1.5 text-gray-400 hover:text-white rounded-xs bg-[#111A16] border border-[#2A3B33] hover:border-[#A3B8AD] transition-colors"
                title="Открыть в модальном окне"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: User's Actual Thread / Story Element */}
            <div className="p-4 rounded-sm bg-[#111A16] border border-[#2A3B33] space-y-2">
              <div className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest text-gray-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#7C9082]" />
                <span>Зафиксированное отражение:</span>
              </div>
              <p className="font-serif text-base text-[#EAEAEA] italic leading-relaxed">
                "{selectedEvent.userContent || 'Элемент формируется...'}"
              </p>
            </div>

            {/* Right: Chronological & Archetypal Insight */}
            <div className="p-4 rounded-sm bg-[#111A16] border border-[#2A3B33] space-y-2">
              <div className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest text-[#D4AF37]">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Значение на шкале времени:</span>
              </div>
              <p className="font-sans text-xs text-gray-300 leading-relaxed">
                {selectedEvent.insight}
              </p>
            </div>
          </div>

          {/* Quick navigation & Modal trigger footer */}
          <div className="flex items-center justify-between pt-2 text-xs text-gray-400">
            <button
              type="button"
              onClick={() => setModalEvent(selectedEvent)}
              className="flex items-center gap-1.5 text-[11px] text-[#D4AF37] hover:underline"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Раскрыть полный разбор этого этапа</span>
            </button>

            <div className="flex items-center gap-2">
              {(() => {
                const curIdx = events.findIndex(e => e.id === selectedEvent.id);
                const nextEvt = events[(curIdx + 1) % events.length];
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedEventId(nextEvt.id)}
                    className="flex items-center gap-1 text-[11px] text-[#A3B8AD] hover:text-[#EAEAEA] transition-colors"
                  >
                    <span>Следующий этап ({nextEvt.phase.split('.')[1] || nextEvt.phase})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                );
              })()}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Modal Window for Details */}
      <TimelineDetailModal 
        event={modalEvent} 
        onClose={() => setModalEvent(null)} 
        onPrev={handleModalPrev}
        onNext={handleModalNext}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Dedicated Modal Window for Deep Dive Timeline Event
// ----------------------------------------------------------------------------
interface TimelineDetailModalProps {
  event: TimelineEvent | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function TimelineDetailModal({ event, onClose, onPrev, onNext }: TimelineDetailModalProps) {
  if (!event) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Content Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#141F1A] border border-[#2A3B33] rounded-sm p-6 sm:p-8 shadow-2xl z-10 text-left space-y-6"
          style={{
            boxShadow: `0 0 40px ${event.glowColor}`
          }}
        >
          {/* Top Bar: Navigation & Close */}
          <div className="flex items-center justify-between pb-4 border-b border-[#2A3B33]">
            <div className="flex items-center gap-2">
              <span 
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: event.color }}
              />
              <span className="font-mono text-xs uppercase tracking-widest text-[#A3B8AD]">
                {event.phase} · {event.timeEra}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrev}
                className="p-1.5 rounded-xs bg-[#1A2621] border border-[#2A3B33] text-gray-400 hover:text-white hover:border-[#A3B8AD] transition-colors"
                title="Предыдущий маркер"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onNext}
                className="p-1.5 rounded-xs bg-[#1A2621] border border-[#2A3B33] text-gray-400 hover:text-white hover:border-[#A3B8AD] transition-colors"
                title="Следующий маркер"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xs bg-[#1A2621] border border-[#2A3B33] text-gray-400 hover:text-white hover:border-red-400/50 transition-colors ml-2"
                title="Закрыть (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Event Header with Symbol & Alchemical Tag */}
          <div className="flex items-start gap-4">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center border shrink-0"
              style={{ 
                borderColor: event.color, 
                backgroundColor: event.accentBg, 
                color: event.color 
              }}
            >
              {event.icon}
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider border border-[#2A3B33] bg-[#0F1613] text-[#D4AF37]">
                  {event.alchemicalStage}
                </span>
                <span className="text-xs text-gray-400 font-sans">
                  {event.subtitle}
                </span>
              </div>
              <h3 className="font-serif text-2xl sm:text-3xl text-[#F4F4F4]">
                {event.title}
              </h3>
            </div>
          </div>

          {/* User's Reflection if present */}
          {event.userContent && (
            <div className="p-4 rounded-sm bg-[#0E1713] border border-[#2A3B33] space-y-1.5">
              <div className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest text-[#7C9082]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ваше отражение в этой точке:</span>
              </div>
              <p className="font-serif text-base sm:text-lg text-[#EAEAEA] italic leading-relaxed">
                «{event.userContent}»
              </p>
            </div>
          )}

          {/* Deep Archetypal & Chronological Narrative */}
          <div className="space-y-3">
            <h4 className="font-mono text-xs uppercase tracking-widest text-[#D4AF37] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Глубинный смысл этапа</span>
            </h4>
            <p className="font-sans text-sm text-gray-300 leading-relaxed">
              {event.detailedDescription}
            </p>
          </div>

          {/* Multi-Column Meta Details: Alchemy, Body, Question */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 rounded-sm bg-[#1A2621] border border-[#2A3B33] space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#A3B8AD]">
                Алхимический принцип
              </span>
              <p className="font-sans text-xs text-gray-300 leading-relaxed">
                {event.alchemicalMeaning}
              </p>
            </div>

            <div className="p-3.5 rounded-sm bg-[#1A2621] border border-[#2A3B33] space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#A3B8AD]">
                Телесный фокус
              </span>
              <p className="font-sans text-xs text-gray-300 leading-relaxed">
                {event.bodyFocus}
              </p>
            </div>
          </div>

          {/* Key Question / Reflection Catalyst */}
          <div className="p-4 rounded-sm bg-[#17221C] border border-[#A3B8AD]/30 space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest text-[#D4AF37]">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Ключевой вопрос для размышления</span>
            </div>
            <p className="font-serif text-base text-[#F4F4F4] leading-relaxed">
              {event.keyQuestion}
            </p>
          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-[#2A3B33] text-xs">
            <span className="font-mono text-[10px] text-gray-500 uppercase">
              Нажмите Esc или кликните вне окна, чтобы закрыть
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xs bg-[#A3B8AD] text-[#0F1412] font-sans font-medium hover:bg-white transition-colors"
            >
              Вернуться к мифу
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

