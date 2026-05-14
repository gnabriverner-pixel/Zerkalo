import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import CodeArchitecture from './components/CodeArchitecture';
import PersonalMyth from './components/PersonalMyth';

export default function App() {
  const [mode, setMode] = useState<'code' | 'myth'>('code');

  return (
    <div className="min-h-screen w-full flex flex-col font-sans transition-colors duration-700" style={{ backgroundColor: mode === 'code' ? '#FAFAFA' : '#0F1412' }}>
      
      {/* Navigation */}
      <div className="fixed top-0 left-0 w-full flex justify-center z-50 py-4 px-2 sm:px-4">
        <div className="flex flex-wrap sm:flex-nowrap justify-center gap-1 sm:gap-2 p-1 bg-black/5 backdrop-blur-md rounded-2xl sm:rounded-full border border-black/5">
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 12px rgba(200, 164, 93, 0.3)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setMode('code')}
            className={`px-4 sm:px-6 py-2 rounded-full text-[10px] sm:text-xs tracking-widest uppercase transition-colors duration-500 border border-transparent ${mode === 'code' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Архитектура
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 12px rgba(163, 184, 173, 0.3)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setMode('myth')}
            className={`px-4 sm:px-6 py-2 rounded-full text-[10px] sm:text-xs tracking-widest uppercase transition-colors duration-500 border ${mode === 'myth' ? 'bg-[#1A2621] text-[#A3B8AD] shadow-sm border-[#2A3B33]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            Личный Миф
          </motion.button>
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
