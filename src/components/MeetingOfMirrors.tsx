import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  BookOpen, 
  Compass, 
  MessageSquare, 
  Feather, 
  RefreshCw, 
  GitFork,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { CalculationResult, FirstMirror, StoryInputs, ApiResponse, MeetingOfMirrorsResult, MeetingApiResponse } from '../types';
import { CosmicParticleBackground } from './CosmicParticleBackground';
import { AlbertDialogue } from './AlbertDialogue';

interface MeetingOfMirrorsProps {
  codeResult: CalculationResult | null;
  firstMirror: FirstMirror | null;
  storyInputs: StoryInputs | null;
  storyResult: ApiResponse['story_result'] | null;
  onOpenCode: () => void;
  onOpenMyth: () => void;
}

export function MeetingOfMirrors({
  codeResult,
  firstMirror,
  storyInputs,
  storyResult,
  onOpenCode,
  onOpenMyth
}: MeetingOfMirrorsProps) {
  const [meetingResult, setMeetingResult] = useState<MeetingOfMirrorsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAlbertOpen, setIsAlbertOpen] = useState(false);
  const [albertTopic, setAlbertTopic] = useState('');
  const [userNote, setUserNote] = useState('');

  const hasCode = !!codeResult;
  const hasMyth = !!storyResult && !!storyInputs;
  const isReadyForSynthesis = hasCode && hasMyth;

  const handleRunSynthesis = async () => {
    if (!isReadyForSynthesis) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/meeting-of-mirrors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeData: {
            calc: codeResult,
            firstMirror: firstMirror || undefined
          },
          storyData: {
            storyInputs,
            storyResult
          }
        })
      });

      const data: MeetingApiResponse = await response.json();

      if (data.status === 'ok' && data.result) {
        setMeetingResult(data.result);
      } else {
        setErrorMessage(data.ui?.safe_message || 'Не удалось сформировать встречу зеркал. Пожалуйста, попробуйте еще раз.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Сетевая ошибка при сопоставлении линз.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 bg-[#0F1412] min-h-screen text-[#EAEAEA] font-sans relative overflow-x-hidden w-full">
      <CosmicParticleBackground />

      <div className="w-full max-w-3xl flex flex-col items-center relative z-10">
        
        {/* Title Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A2621] border border-[#2A3B33] text-[#A3B8AD] text-[11px] tracking-widest uppercase mb-4">
            <GitFork size={12} className="text-[#C8A45D]" />
            <span>Синтез двух независимых взглядов</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-[#F4F4F4] mb-3 tracking-wide">
            Встреча Зеркал
          </h1>
          <p className="text-sm text-gray-400 max-w-lg mx-auto leading-relaxed">
            Сопоставление объективной числовой матрицы по дате рождения и субъективного мира ваших метафор.
          </p>
        </div>

        {/* LENSES STATUS CARD */}
        <div className="w-full bg-[#111A16] border border-[#2A3B33] p-6 mb-8 rounded-sm">
          <h3 className="text-xs uppercase tracking-widest text-[#A3B8AD] mb-4 flex items-center gap-2">
            <Layers size={14} />
            <span>Состояние исходных линз</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Lens A: Digital Code */}
            <div className={`p-4 border transition-all ${
              hasCode ? 'bg-[#15211B] border-[#3A4E43]' : 'bg-[#121614] border-[#222B26] opacity-75'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider text-[#A3B8AD]">Линза 1: Цифровой Код</span>
                {hasCode ? (
                  <CheckCircle2 size={16} className="text-[#7C9082]" />
                ) : (
                  <span className="text-[10px] text-gray-500 uppercase">Не рассчитан</span>
                )}
              </div>
              {hasCode ? (
                <div>
                  <div className="font-serif text-lg text-[#F4F4F4]">
                    {codeResult.soul} · {codeResult.path} · {codeResult.expression} · {codeResult.direction} · {codeResult.result}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Душа {codeResult.soul} ({codeResult.soulComposite || codeResult.soul}) / Путь {codeResult.path}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400 flex flex-col items-start gap-2 mt-1">
                  <span>Введите дату рождения, чтобы сформировать расчет.</span>
                  <button 
                    onClick={onOpenCode}
                    className="text-[11px] text-[#C8A45D] hover:underline uppercase tracking-wider flex items-center gap-1"
                  >
                    Перейти к коду <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Lens B: Personal Myth */}
            <div className={`p-4 border transition-all ${
              hasMyth ? 'bg-[#15211B] border-[#3A4E43]' : 'bg-[#121614] border-[#222B26] opacity-75'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider text-[#A3B8AD]">Линза 2: Личный Миф</span>
                {hasMyth ? (
                  <CheckCircle2 size={16} className="text-[#7C9082]" />
                ) : (
                  <span className="text-[10px] text-gray-500 uppercase">Не собран</span>
                )}
              </div>
              {hasMyth ? (
                <div>
                  <div className="font-serif text-lg text-[#F4F4F4] truncate">
                    «{storyResult?.title || 'Сказка про тебя'}»
                  </div>
                  <div className="text-xs text-gray-400 mt-1 truncate">
                    Образ: {storyInputs?.q2 || 'Создан'}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400 flex flex-col items-start gap-2 mt-1">
                  <span>Ответьте на 4 вопроса, чтобы создать образную историю.</span>
                  <button 
                    onClick={onOpenMyth}
                    className="text-[11px] text-[#A3B8AD] hover:underline uppercase tracking-wider flex items-center gap-1"
                  >
                    Перейти к мифу <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Action Button */}
          {!meetingResult && (
            <div className="mt-6 text-center">
              {isReadyForSynthesis ? (
                <button
                  onClick={handleRunSynthesis}
                  disabled={isLoading}
                  className="px-8 py-4 bg-[#A3B8AD] text-[#0F1412] tracking-[0.2em] font-sans uppercase text-xs font-semibold hover:bg-[#8CA296] transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-3 mx-auto shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Сопоставляем зеркала...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Провести Встречу Зеркал</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="text-xs text-amber-300/80 bg-amber-950/20 border border-amber-800/30 p-3 rounded-xs inline-block">
                  Пройдите обе линзы (Код и Миф) для сопоставления их независимых результатов.
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 p-3 bg-red-950/30 border border-red-800/40 text-red-300 text-xs text-center">
              {errorMessage}
            </div>
          )}
        </div>

        {/* SYNTHESIS RESULT VIEW */}
        <AnimatePresence>
          {meetingResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full space-y-8"
            >
              {/* Ethical Frame Notice */}
              <div className="p-5 bg-[#15211B]/60 border border-[#2A3B33] rounded-xs text-xs text-gray-300 leading-relaxed text-center font-serif italic">
                {meetingResult.disclaimer}
              </div>

              {/* Overview Summary */}
              <div className="bg-[#111A16] border border-[#2A3B33] p-6 sm:p-8">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <span className="text-[11px] uppercase tracking-widest text-[#A3B8AD]">Общее сопоставление</span>
                  <span className={`text-[10px] uppercase px-2.5 py-1 rounded-full border ${
                    meetingResult.hasStrongParallels 
                      ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300' 
                      : 'bg-stone-900 border-stone-700 text-stone-300'
                  }`}>
                    {meetingResult.confidenceNote}
                  </span>
                </div>
                <p className="font-serif text-lg text-gray-200 leading-relaxed">
                  {meetingResult.summary}
                </p>
              </div>

              {/* PARALLELS SECTION (if any) */}
              {meetingResult.parallels && meetingResult.parallels.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#A3B8AD]">
                    <Sparkles size={14} className="text-[#C8A45D]" />
                    <span>Точки смыслового пересечения</span>
                  </div>

                  <div className="space-y-4">
                    {meetingResult.parallels.map((item, idx) => (
                      <div key={idx} className="bg-[#111A16] border border-[#2A3B33] p-6 transition-all hover:border-[#3E5246]">
                        <h4 className="font-serif text-lg text-[#F4F4F4] mb-3">{item.theme}</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
                          <div className="p-3 bg-[#15211B] border border-[#23332A]">
                            <span className="text-[10px] uppercase text-[#A3B8AD] block mb-1">Линза Кода:</span>
                            <span className="text-gray-300 leading-relaxed">{item.codeAnchor}</span>
                          </div>
                          <div className="p-3 bg-[#15211B] border border-[#23332A]">
                            <span className="text-[10px] uppercase text-[#A3B8AD] block mb-1">Линза Мифа:</span>
                            <span className="text-gray-300 leading-relaxed">{item.mythAnchor}</span>
                          </div>
                        </div>

                        <p className="text-sm text-gray-300 border-t border-[#23332A] pt-3 leading-relaxed">
                          {item.synthesis}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DIVERGENCES / CONTRASTS (if any) */}
              {meetingResult.divergences && meetingResult.divergences.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#A3B8AD]">
                    <GitFork size={14} className="text-[#7C9082]" />
                    <span>Различия ракурсов и дополняющие грани</span>
                  </div>

                  <div className="space-y-4">
                    {meetingResult.divergences.map((div, idx) => (
                      <div key={idx} className="bg-[#111A16] border border-[#2A3B33] p-6">
                        <h4 className="font-serif text-base text-[#EAEAEA] mb-3">{div.theme}</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 text-xs">
                          <div className="p-3 bg-[#171E1B] border border-[#23332A] text-gray-400">
                            <span className="text-[10px] uppercase text-gray-500 block mb-1">В Коде:</span>
                            {div.codeAspect}
                          </div>
                          <div className="p-3 bg-[#171E1B] border border-[#23332A] text-gray-400">
                            <span className="text-[10px] uppercase text-gray-500 block mb-1">В Мифе:</span>
                            {div.mythAspect}
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 italic">
                          {div.reflection}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ALBERT'S SYNTHESIS INSIGHT */}
              <div className="bg-[#15211B] border border-[#3A4E43] p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Feather size={16} className="text-[#C8A45D]" />
                  <span className="text-xs uppercase tracking-widest text-[#C8A45D]">Взгляд Альберта Вяземского</span>
                </div>
                <p className="font-serif text-lg sm:text-xl text-[#F4F4F4] leading-relaxed mb-6">
                  {meetingResult.albertInsight}
                </p>

                {/* Living Reflective Question */}
                <div className="border-t border-[#2A3B33] pt-6 mt-6">
                  <span className="text-[11px] uppercase tracking-widest text-[#A3B8AD] block mb-2">
                    Вопрос для личного исследования
                  </span>
                  <p className="font-serif italic text-base sm:text-lg text-emerald-200/90 mb-4">
                    {meetingResult.reflectiveQuestion}
                  </p>
                  <textarea
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    placeholder="Запишите здесь мысли, которые рождаются от этой встречи..."
                    className="w-full bg-[#0F1412] border border-[#2A3B33] text-gray-200 text-sm p-4 outline-none focus:border-[#A3B8AD] resize-none h-24 rounded-xs placeholder:text-gray-600"
                  />
                </div>
              </div>

              {/* ALBERT CONTINUATION CTA */}
              <div className="p-8 bg-[#111A16] border border-[#2A3B33] text-center space-y-4">
                <h3 className="font-serif text-2xl text-[#F4F4F4]">Продолжить исследование с Альбертом</h3>
                <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                  Вы можете обсудить результаты встречи зеркал напрямую, задать уточняющий вопрос или перейти к полному анализу.
                </p>

                <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setAlbertTopic(`Обсуждение встречи двух зеркал: Душа ${codeResult?.soul}, Путь ${codeResult?.path}, образ Мифа "${storyResult?.title}".`);
                      setIsAlbertOpen(true);
                    }}
                    className="px-8 py-3.5 bg-[#A3B8AD] text-[#0F1412] tracking-widest uppercase text-xs font-semibold hover:bg-[#8CA296] transition-all flex items-center justify-center gap-2"
                  >
                    <MessageSquare size={15} />
                    <span>Диалог с Альбертом</span>
                  </button>

                  <a
                    href="https://t.me/vyazemsky_albert" 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-8 py-3.5 border border-[#2A3B33] text-[#A3B8AD] tracking-widest uppercase text-xs hover:border-[#A3B8AD] hover:text-[#EAEAEA] transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={14} />
                    <span>Telegram-проводник</span>
                  </a>
                </div>
              </div>

              {/* Refresh / Recalculate */}
              <div className="text-center pt-4 pb-12">
                <button
                  onClick={handleRunSynthesis}
                  className="text-xs text-gray-500 hover:text-gray-300 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
                >
                  <RefreshCw size={12} />
                  <span>Обновить сопоставление</span>
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Albert Dialogue Modal */}
      <AlbertDialogue
        isOpen={isAlbertOpen}
        onClose={() => setIsAlbertOpen(false)}
        calc={codeResult}
        initialTopic={albertTopic}
        theme="dark"
      />
    </div>
  );
}
