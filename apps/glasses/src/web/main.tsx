import { createRoot } from 'react-dom/client';
import './styles.css';
import { boot } from '../boot';
import { App } from './components/App';
import { installLogger } from './logger';

installLogger();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found');
createRoot(rootEl).render(<App />);

boot().catch(() => {});
