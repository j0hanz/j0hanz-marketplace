import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './index.css';

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { motionOk } from './motion';
import { theme } from './theme/mui';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

// Gates every hidden start-state in index.css, so the page is only ever
// withheld from a visitor whose browser can and will animate it back.
if (motionOk()) document.documentElement.dataset.motion = 'on';

createRoot(root).render(
  <StrictMode>
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
