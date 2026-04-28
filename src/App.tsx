import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import CodeArchitecture from './components/CodeArchitecture';
import PersonalMyth from './components/PersonalMyth';

export default function App() {
  const [mode, setMode] = useState<'code' | 'myth'>('code');

  return (
    <div className="min-h-screen w-full flex flex-col font-sans transition-colors duration-700" style={{ backgroundColor: mode === 'code' ? '#FAFAFA' : '#0F1412' }}>
      
      {/* Navigation */}
      <div className="fixed top-0 left-0 w-full flex justify-center z-50 py-4 px-4">
        <div className="flex gap-2 p-1 bg-black/5 backdrop-blur-md rounded-full border border-black/5">
          <button
            onClick={() => setMode('code')}
            className={`px-6 py-2 rounded-full text-xs tracking-widest uppercase transition-all duration-300 ${mode === 'code' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Архитектура
          </button>
          <button
            onClick={() => setMode('myth')}
            className={`px-6 py-2 rounded-full text-xs tracking-widest uppercase transition-all duration-300 ${mode === 'myth' ? 'bg-[#1A2621] text-[#A3B8AD] shadow-sm border border-[#2A3B33]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Личный Миф
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'code' ? (
          <motion.div
            key="code"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full flex-grow flex flex-col pt-16"
          >
            <CodeArchitecture />
          </motion.div>
        ) : (
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
