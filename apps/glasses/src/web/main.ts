import './styles.css';
import { boot } from '../boot';
import { installLogger } from './logger';

installLogger();

boot().catch(() => {});
