import { createRoot } from 'react-dom/client';
import './assets/styles.css';
import { boot } from '../boot';
import { App } from './App';
import { AppProviders } from './providers';
import { installLogger } from './utils/logger';

installLogger();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found');
createRoot(rootEl).render(
  <AppProviders>
    <App />
  </AppProviders>,
);

boot().catch(() => {});
