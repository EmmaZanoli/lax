import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Font self-hosted (nessun link a Google Fonts: l'app deve girare offline).
import '@fontsource-variable/fraunces/standard.css'; // assi wght + opsz
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import './tokens/global.css';

import { App } from './App';
import { ToastProvider } from './components';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Elemento #root non trovato');

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
