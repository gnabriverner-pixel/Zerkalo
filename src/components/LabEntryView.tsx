import React from 'react';
import { motion } from 'motion/react';
import { 
  Compass, 
  BookOpen, 
  Sparkles, 
  GitFork, 
  ArrowRight, 
  CheckCircle2, 
  Sliders,
  Feather,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { CalculationResult, FirstMirror, StoryInputs, ApiResponse } from '../types';

interface LabEntryViewProps {
  codeResult: CalculationResult | null;
  storyResult: ApiResponse['story_result'] | null;
  onSelectMode: (mode: 'code' | 'myth' | 'meeting' | 'ab-test') => void;
}

export function LabEntryView({
  codeResult,
  storyResult,
  onSelectMode
}: LabEntryViewProps) {
  const hasCode = !!codeResult;
  const hasMyth = !!storyResult;
  const hasBoth = hasCode && hasMyth;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 sm:px-6 py-12 text-[#EAEAEA]">
      <div className="w-full max-w-4xl flex flex-col items-center text-center">
        
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#1A2621] border border-[#2A3B33] text-[#A3B8AD] text-[11px] tracking-widest uppercase mb-6"
        >
          <Sparkles size={12} className="text-[#C8A45D]" />
          <span>Интерактивная лаборатория самопознания</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-serif text-3xl sm:text-5xl lg:text-6xl text-[#F4F4F4] mb-4 tracking-wide font-normal max-w-3xl leading-tight"
        >
          Как вы хотите посмотреть на себя сегодня?
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-sm sm:text-base text-gray-400 max-w-2xl mb-12 leading-relaxed"
        >
          Два самостоятельных пути самопознания. Вы можете выбрать любой или сопоставить оба во Встрече Зеркал:
        </motion.p>

        {/* TWO LENSES GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8">
          
          {/* LENS 1: CODE */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => onSelectMode('code')}
            className="group relative bg-[#131A16] hover:bg-[#18231E] border border-[#2A3B33] hover:border-[#C8A45D]/50 p-8 rounded-xs text-left transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#C8A45D] bg-[#1F2B24] px-2.5 py-1 rounded-xs border border-[#304238]">
                  Линза 1 · Структура
                </span>
                {hasCode && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#7C9082]">
                    <CheckCircle2 size={14} /> Рассчитано
                  </span>
                )}
              </div>

              <h2 className="font-serif text-2xl text-[#F4F4F4] group-hover:text-[#C8A45D] transition-colors mb-3">
                Цифровой Код
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-6">
                Детерминированная нумерологическая матрица по системе Альберта Вяземского. Анализ пяти главных чисел: Душа, Путь, Выражение, Направление и Результат.
              </p>
            </div>

            <div className="pt-4 border-t border-[#23332A] flex items-center justify-between text-xs text-[#C8A45D] font-medium tracking-wider uppercase">
              <span>{hasCode ? 'Открыть расчет' : 'Рассчитать дату'}</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>

          {/* LENS 2: MYTH */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => onSelectMode('myth')}
            className="group relative bg-[#131A16] hover:bg-[#18231E] border border-[#2A3B33] hover:border-[#A3B8AD]/60 p-8 rounded-xs text-left transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#A3B8AD] bg-[#1F2B24] px-2.5 py-1 rounded-xs border border-[#304238]">
                  Линза 2 · Метафора
                </span>
                {hasMyth && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#7C9082]">
                    <CheckCircle2 size={14} /> Создан
                  </span>
                )}
              </div>

              <h2 className="font-serif text-2xl text-[#F4F4F4] group-hover:text-[#A3B8AD] transition-colors mb-1">
                Личный Миф
              </h2>
              <div className="text-xs text-[#A3B8AD]/80 uppercase tracking-widest font-mono mb-3">
                Сказка про тебя
              </div>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-6">
                Четыре образных вопроса. Никакой даты рождения — только персональная философская сказка, рождающаяся строго из ваших метафор.
              </p>
            </div>

            <div className="pt-4 border-t border-[#23332A] flex items-center justify-between text-xs text-[#A3B8AD] font-medium tracking-wider uppercase">
              <span>{hasMyth ? 'Открыть миф' : 'Создать сказку'}</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>

        </div>

        {/* MEETING OF MIRRORS BANNER */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={() => onSelectMode('meeting')}
          className={`w-full p-6 sm:p-8 rounded-xs border transition-all cursor-pointer text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 ${
            hasBoth
              ? 'bg-[#15241D] border-[#3E5A4B] hover:border-[#6C9680]'
              : 'bg-[#111714] border-[#222F27] hover:border-[#2F4136]'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1A2821] border border-[#2D4035] flex items-center justify-center shrink-0 text-[#C8A45D]">
              <GitFork size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#A3B8AD]">
                  Синтез · Смысловой мост
                </span>
                {hasBoth && (
                  <span className="text-[10px] bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 px-2 py-0.5 rounded-full">
                    Готово к сопоставлению
                  </span>
                )}
              </div>
              <h3 className="font-serif text-xl sm:text-2xl text-[#F4F4F4] mb-1">
                Встреча Зеркал
              </h3>
              <p className="text-xs text-gray-400 max-w-lg leading-relaxed">
                Сопоставление двух независимых отражений: где структура вашей даты перекликается с вашими метафорами, а где открывает разные ракурсы.
              </p>
            </div>
          </div>

          <button
            className={`px-6 py-3 uppercase tracking-widest text-xs font-semibold rounded-xs transition-all shrink-0 flex items-center gap-2 ${
              hasBoth
                ? 'bg-[#A3B8AD] text-[#0F1412] hover:bg-[#8CA296]'
                : 'border border-[#2D4035] text-[#A3B8AD] hover:bg-[#1A2821]'
            }`}
          >
            <span>{hasBoth ? 'Провести синтез' : 'Обзор встречи'}</span>
            <ArrowRight size={14} />
          </button>
        </motion.div>

        {/* OWNER HARNESS LINK */}
        <div className="mt-10 pt-6 border-t border-[#1C2721] w-full flex flex-wrap justify-between items-center text-xs text-gray-500 gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#7C9082]" />
            <span>Каждая линза формируется строго независимо</span>
          </div>

          <button
            onClick={() => onSelectMode('ab-test')}
            className="text-gray-500 hover:text-[#C8A45D] flex items-center gap-1.5 transition-colors"
          >
            <Sliders size={13} />
            <span>Лаборатория моделей (A/B тест)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
