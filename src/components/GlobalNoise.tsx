import React from 'react';

export const GlobalNoise = () => {
  return (
    <>
      <style>
        {`
          @keyframes noise-shift {
            0% { transform: translate(0, 0); }
            10% { transform: translate(-5%, -5%); }
            20% { transform: translate(-10%, 5%); }
            30% { transform: translate(5%, -10%); }
            40% { transform: translate(-5%, 15%); }
            50% { transform: translate(-10%, 5%); }
            60% { transform: translate(15%, 0); }
            70% { transform: translate(0, 15%); }
            80% { transform: translate(3%, 35%); }
            90% { transform: translate(-10%, 10%); }
            100% { transform: translate(0, 0); }
          }
          .noise-layer {
            animation: noise-shift 8s steps(10) infinite;
            width: 200%;
            height: 200%;
            top: -50%;
            left: -50%;
          }
        `}
      </style>
      <div className="fixed inset-0 pointer-events-none z-[9998] opacity-[0.03] mix-blend-multiply overflow-hidden">
        <div 
          className="absolute noise-layer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat'
          }}
        />
      </div>
      <div className="fixed inset-0 pointer-events-none z-[9999] shadow-[inset_0_0_150px_rgba(30,25,18,0.08)] mix-blend-multiply" />
      
      {/* Mirror-like highlights */}
      <div className="fixed top-0 left-0 w-full h-[30vh] pointer-events-none z-[9999] bg-gradient-to-b from-white/5 to-transparent mix-blend-overlay" />
      <div className="fixed bottom-0 right-0 w-[50vw] h-[50vh] pointer-events-none z-[9999] bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-white/5 to-transparent mix-blend-overlay" />
    </>
  );
};
