import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {MythExamplePage, isMythExamplePath} from './components/MythExamplePage';
import './index.css';

// The public Myth example is a standalone page: no consent, no requests.
const page = isMythExamplePath(window.location.pathname) ? <MythExamplePage /> : <App />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {page}
  </StrictMode>,
);
