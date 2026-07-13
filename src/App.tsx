import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import CodeArchitecture from './components/CodeArchitecture';
import PersonalMyth from './components/PersonalMyth';
import { ProductTrustLayer } from './components/ProductTrustLayer';

export default function App() {
  const [mode, setMode] = useState<'code' | 'myth'>('code');

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans transition-all duration-700 ${mode === 'code' ? 'bg-linen' : 'bg-dark-velvet'}`}>
      
      {/* Navigation */}
      <div className="fixed top-0 left-0 w-full flex justify-center z-50 py-4 px-2 sm:px-4">
        <div className="flex flex-wrap sm:flex-nowrap justify-center gap-1 sm:gap-2 p-1.5 bg-white/20 dark:bg-black/20 backdrop-blur-xl rounded-full border border-white/10 dark:border-white/5 shadow-lg">
          <button
            onClick={() => setMode('code')}
            className={`px-6 py-2.5 rounded-full text-[10px] sm:text-xs tracking-widest uppercase transition-all duration-500 font-semibold cursor-pointer ${mode === 'code' ? 'bg-[#C8A45D] text-white shadow-md' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Архитектура
          </button>
          <button
            onClick={() => setMode('myth')}
            className={`px-6 py-2.5 rounded-full text-[10px] sm:text-xs tracking-widest uppercase transition-all duration-500 font-semibold cursor-pointer ${mode === 'myth' ? 'bg-[#DCB059] text-black shadow-md' : 'text-gray-400 hover:text-[#DCB059]'}`}
          >
            Личный Миф
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'code' && (
          <motion.div
            key="code"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full flex-grow flex flex-col pt-16"
          >
            <CodeArchitecture />
            <ProductTrustLayer />
          </motion.div>
        )}
        {mode === 'myth' && (
          <motion.div
            key="myth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full flex-grow flex flex-col pt-16"
          >
            <PersonalMyth />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
