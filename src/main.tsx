import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/600.css';
import { App } from './App';
import { clearMeasureCache } from './lib/measure';
import './index.css';

const root = document.getElementById('root');

function render() {
  clearMeasureCache();
  if (!root) return;
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

const fonts = document.fonts;
if (fonts?.load) {
  Promise.all([fonts.load('400 17px "Source Serif 4"'), fonts.load('600 14px "Source Sans 3"')]).finally(render);
} else {
  render();
}
