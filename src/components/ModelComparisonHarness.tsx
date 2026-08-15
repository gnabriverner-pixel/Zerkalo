import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Sliders
} from 'lucide-react';
import { ABComparisonResponse, StoryInputs } from '../types';
import { AB_FIXTURES } from '../data/abFixtures';

export function ModelComparisonHarness() {
  const [selectedFixtureIdx, setSelectedFixtureIdx] = useState<number>(0);
  const [customMode, setCustomMode] = useState(false);
  const [customInputs, setCustomInputs] = useState<StoryInputs>({
    q1: '',
    q2: '',
    q3: '',
    q4: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<ABComparisonResponse | null>(null);
  const [comparisonId, setComparisonId] = useState('');
  const [revealData, setRevealData] = useState<{ aModel: string; bModel: string } | null>(null);
  const [showModelNames, setShowModelNames] = useState(false);
  const [selectedVote, setSelectedVote] = useState<'A' | 'B' | 'TIE' | null>(null);
  const [errorText, setErrorText] = useState('');

  const currentFixture = AB_FIXTURES[selectedFixtureIdx];

  const handleRunComparison = async () => {
    setIsLoading(true);
    setErrorText('');
    setShowModelNames(false);
    setSelectedVote(null);
    setRevealData(null);

    try {
      const payload = customMode 
        ? { customInputs }
        : { fixtureIndex: selectedFixtureIdx };

      const response = await fetch('/api/ab-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data: ABComparisonResponse = await response.json();

      if (data.status === 'ok') {
        setComparisonData(data);
        setComparisonId((data as any).comparisonId || '');
      } else {
        setErrorText(data.ui?.safe_message || 'Ошибка при формировании сравнительной генерации.');
      }
    } catch (err) {
      console.error(err);
      setErrorText('Сетевая ошибка при обращении к серверу.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReveal = async () => {
    if (showModelNames) {
      setShowModelNames(false);
      return;
    }
    if (!comparisonId) return;
    try {
      const response = await fetch('/api/ab-reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comparisonId })
      });
      const data = await response.json();
      if (data.status === 'ok') {
        setRevealData({ aModel: data.variantA.actualModel, bModel: data.variantB.actualModel });
        setShowModelNames(true);
      } else {
        setErrorText(data.ui?.safe_message || 'Не удалось раскрыть модели.');
      }
    } catch (err) {
      console.error(err);
      setErrorText('Сетевая ошибка при раскрытии моделей.');
    }
  };

  return (
    <div className="flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 bg-[#0B0F0D] min-h-screen text-[#EAEAEA] font-sans w-full">
      <div className="w-full max-w-5xl flex flex-col items-center">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#15211B] border border-[#2A3B33] text-[#A3B8AD] text-[11px] tracking-widest uppercase mb-3">
            <Sliders size={12} className="text-[#C8A45D]" />
            <span>Лаборатория моделей: Слепой A/B Тест</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#F4F4F4] mb-2">
            Сравнение литературного качества
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto leading-relaxed">
            Оценка естественности, образности и глубины русского языка без предвзятости к названию модели.
          </p>
        </div>

        {/* Fixture Selector */}
        <div className="w-full bg-[#111A16] border border-[#2A3B33] p-5 mb-8 rounded-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <span className="text-xs uppercase tracking-widest text-[#A3B8AD]">Выберите тестовый сценарий (5 фикстур):</span>
            <button
              onClick={() => {
                setCustomMode(!customMode);
                setComparisonData(null);
              }}
              className="text-xs text-[#C8A45D] hover:underline"
            >
              {customMode ? '← Вернуться к фикстурам' : 'Использовать свой текст'}
            </button>
          </div>

          {!customMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {AB_FIXTURES.map((fix, idx) => (
                <button
                  key={fix.id}
                  onClick={() => {
                    setSelectedFixtureIdx(idx);
                    setComparisonData(null);
                  }}
                  className={`p-3 text-left border rounded-xs transition-all ${
                    selectedFixtureIdx === idx
                      ? 'bg-[#1A2621] border-[#A3B8AD] text-[#F4F4F4]'
                      : 'bg-[#0F1412] border-[#222B26] text-gray-400 hover:border-[#3A4E43] hover:text-gray-200'
                  }`}
                >
                  <span className="text-[10px] text-[#A3B8AD] block font-mono">№0{idx + 1}</span>
                  <span className="font-serif text-sm block font-medium mt-0.5">{fix.title}</span>
                  <span className="text-[10px] text-gray-500 line-clamp-1 mt-1">{fix.subtitle}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">1. Что внутри требует внимания:</label>
                <input
                  type="text"
                  value={customInputs.q1}
                  onChange={(e) => setCustomInputs({ ...customInputs, q1: e.target.value })}
                  placeholder="Ощущение..."
                  className="w-full bg-[#0F1412] border border-[#2A3B33] p-2 text-xs text-gray-200 outline-none focus:border-[#A3B8AD]"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">2. Образ/существо/погода:</label>
                <input
                  type="text"
                  value={customInputs.q2}
                  onChange={(e) => setCustomInputs({ ...customInputs, q2: e.target.value })}
                  placeholder="Образ..."
                  className="w-full bg-[#0F1412] border border-[#2A3B33] p-2 text-xs text-gray-200 outline-none focus:border-[#A3B8AD]"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">3. Момент живости и ясности:</label>
                <input
                  type="text"
                  value={customInputs.q3}
                  onChange={(e) => setCustomInputs({ ...customInputs, q3: e.target.value })}
                  placeholder="Момент..."
                  className="w-full bg-[#0F1412] border border-[#2A3B33] p-2 text-xs text-gray-200 outline-none focus:border-[#A3B8AD]"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">4. Недостающее качество:</label>
                <input
                  type="text"
                  value={customInputs.q4}
                  onChange={(e) => setCustomInputs({ ...customInputs, q4: e.target.value })}
                  placeholder="Качество..."
                  className="w-full bg-[#0F1412] border border-[#2A3B33] p-2 text-xs text-gray-200 outline-none focus:border-[#A3B8AD]"
                />
              </div>
            </div>
          )}

          {/* Active Fixture Context */}
          {!customMode && currentFixture && (
            <div className="mt-4 p-3 bg-[#0F1412] border border-[#222B26] text-xs text-gray-400 space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-[#A3B8AD] block">Входные данные фикстуры:</span>
              <p><strong className="text-gray-300">1. Состояние:</strong> {currentFixture.inputs.q1}</p>
              <p><strong className="text-gray-300">2. Образ:</strong> {currentFixture.inputs.q2}</p>
              <p><strong className="text-gray-300">3. Живость:</strong> {currentFixture.inputs.q3}</p>
              <p><strong className="text-gray-300">4. Качество:</strong> {currentFixture.inputs.q4}</p>
            </div>
          )}

          {/* Run Button */}
          <div className="mt-5 text-center">
            <button
              onClick={handleRunComparison}
              disabled={isLoading}
              className="px-8 py-3.5 bg-[#A3B8AD] text-[#0F1412] uppercase tracking-[0.15em] text-xs font-semibold hover:bg-[#8CA296] transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Генерируем обе версии одновременно...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Запустить слепое сравнение</span>
                </>
              )}
            </button>
          </div>

          {errorText && (
            <div className="mt-3 p-2 text-xs text-red-400 bg-red-950/20 border border-red-800/30 text-center">
              {errorText}
            </div>
          )}
        </div>

        {/* COMPARISON RESULTS (SIDE BY SIDE) */}
        <AnimatePresence>
          {comparisonData && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full space-y-6"
            >
              
              {/* Voting Bar */}
              <div className="bg-[#15211B] border border-[#2A3B33] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xs">
                <div className="text-xs">
                  <span className="text-gray-400">Какой вариант звучит глубже, точнее и литературнее?</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedVote('A')}
                    className={`px-4 py-2 text-xs uppercase tracking-wider rounded-xs border transition-all ${
                      selectedVote === 'A'
                        ? 'bg-[#A3B8AD] text-[#0F1412] font-semibold border-[#A3B8AD]'
                        : 'bg-[#0F1412] text-gray-300 border-[#2A3B33] hover:border-[#A3B8AD]'
                    }`}
                  >
                    Вариант А лучше
                  </button>

                  <button
                    onClick={() => setSelectedVote('TIE')}
                    className={`px-4 py-2 text-xs uppercase tracking-wider rounded-xs border transition-all ${
                      selectedVote === 'TIE'
                        ? 'bg-[#A3B8AD] text-[#0F1412] font-semibold border-[#A3B8AD]'
                        : 'bg-[#0F1412] text-gray-300 border-[#2A3B33] hover:border-[#A3B8AD]'
                    }`}
                  >
                    Примерно равны
                  </button>

                  <button
                    onClick={() => setSelectedVote('B')}
                    className={`px-4 py-2 text-xs uppercase tracking-wider rounded-xs border transition-all ${
                      selectedVote === 'B'
                        ? 'bg-[#A3B8AD] text-[#0F1412] font-semibold border-[#A3B8AD]'
                        : 'bg-[#0F1412] text-gray-300 border-[#2A3B33] hover:border-[#A3B8AD]'
                    }`}
                  >
                    Вариант Б лучше
                  </button>
                </div>

                <button
                  onClick={() => void handleReveal()}
                  className="text-xs text-[#C8A45D] hover:underline flex items-center gap-1.5"
                >
                  {showModelNames ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{showModelNames ? 'Скрыть модели' : 'Раскрыть модели'}</span>
                </button>
              </div>

              {/* Side-by-side Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Variant A */}
                <div className={`bg-[#111A16] border p-6 rounded-xs flex flex-col justify-between transition-all ${
                  selectedVote === 'A' ? 'border-[#A3B8AD] shadow-lg shadow-emerald-950/20' : 'border-[#2A3B33]'
                }`}>
                  <div>
                    <div className="flex items-center justify-between border-b border-[#23332A] pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#1A2621] text-[#A3B8AD] text-xs font-serif font-bold flex items-center justify-center">
                          А
                        </span>
                        <span className="font-serif text-lg text-[#F4F4F4]">Вариант А</span>
                      </div>

                      {showModelNames && revealData && (
                        <div className="text-right">
                          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-xs border border-emerald-800/40">
                            {revealData.aModel}
                          </span>
                          <span className="text-[10px] text-gray-500 block mt-0.5">
                            {comparisonData.variantA.latencyMs} мс
                          </span>
                        </div>
                      )}
                    </div>

                    <h3 className="font-serif text-xl text-[#F4F4F4] mb-4">
                      «{comparisonData.variantA.title}»
                    </h3>

                    <div className="font-serif text-sm leading-relaxed text-gray-300 space-y-3 mb-6">
                      {comparisonData.variantA.story.split('\n\n').map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>

                    {comparisonData.variantA.mirror && (
                      <div className="bg-[#15211B] p-4 rounded-xs border border-[#23332A] space-y-2 text-xs mb-6">
                        <p><strong className="text-[#A3B8AD]">Главный образ:</strong> {comparisonData.variantA.mirror.mainImage}</p>
                        <p><strong className="text-[#A3B8AD]">Напряжение:</strong> {comparisonData.variantA.mirror.innerTension}</p>
                        <p><strong className="text-[#A3B8AD]">Ресурс:</strong> {comparisonData.variantA.mirror.hiddenResource}</p>
                        <p><strong className="text-[#A3B8AD]">Новый взгляд:</strong> {comparisonData.variantA.mirror.newView}</p>
                      </div>
                    )}

                    <div className="border-t border-[#23332A] pt-4 space-y-2 text-xs">
                      <p><strong className="text-[#A3B8AD]">Один шаг:</strong> <span className="font-serif italic text-gray-200">{comparisonData.variantA.one_step}</span></p>
                      <p><strong className="text-[#A3B8AD]">Вопрос:</strong> <span className="text-gray-300">{comparisonData.variantA.journal_question}</span></p>
                    </div>
                  </div>
                </div>

                {/* Variant B */}
                <div className={`bg-[#111A16] border p-6 rounded-xs flex flex-col justify-between transition-all ${
                  selectedVote === 'B' ? 'border-[#A3B8AD] shadow-lg shadow-emerald-950/20' : 'border-[#2A3B33]'
                }`}>
                  <div>
                    <div className="flex items-center justify-between border-b border-[#23332A] pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#1A2621] text-[#A3B8AD] text-xs font-serif font-bold flex items-center justify-center">
                          Б
                        </span>
                        <span className="font-serif text-lg text-[#F4F4F4]">Вариант Б</span>
                      </div>

                      {showModelNames && revealData && (
                        <div className="text-right">
                          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-xs border border-emerald-800/40">
                            {revealData.bModel}
                          </span>
                          <span className="text-[10px] text-gray-500 block mt-0.5">
                            {comparisonData.variantB.latencyMs} мс
                          </span>
                        </div>
                      )}
                    </div>

                    <h3 className="font-serif text-xl text-[#F4F4F4] mb-4">
                      «{comparisonData.variantB.title}»
                    </h3>

                    <div className="font-serif text-sm leading-relaxed text-gray-300 space-y-3 mb-6">
                      {comparisonData.variantB.story.split('\n\n').map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>

                    {comparisonData.variantB.mirror && (
                      <div className="bg-[#15211B] p-4 rounded-xs border border-[#23332A] space-y-2 text-xs mb-6">
                        <p><strong className="text-[#A3B8AD]">Главный образ:</strong> {comparisonData.variantB.mirror.mainImage}</p>
                        <p><strong className="text-[#A3B8AD]">Напряжение:</strong> {comparisonData.variantB.mirror.innerTension}</p>
                        <p><strong className="text-[#A3B8AD]">Ресурс:</strong> {comparisonData.variantB.mirror.hiddenResource}</p>
                        <p><strong className="text-[#A3B8AD]">Новый взгляд:</strong> {comparisonData.variantB.mirror.newView}</p>
                      </div>
                    )}

                    <div className="border-t border-[#23332A] pt-4 space-y-2 text-xs">
                      <p><strong className="text-[#A3B8AD]">Один шаг:</strong> <span className="font-serif italic text-gray-200">{comparisonData.variantB.one_step}</span></p>
                      <p><strong className="text-[#A3B8AD]">Вопрос:</strong> <span className="text-gray-300">{comparisonData.variantB.journal_question}</span></p>
                    </div>
                  </div>
                </div>

              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
