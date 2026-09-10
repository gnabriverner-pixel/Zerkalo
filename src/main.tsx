import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ConsentBoundary} from './components/ConsentBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConsentBoundary><App /></ConsentBoundary>
  </StrictMode>,
);
