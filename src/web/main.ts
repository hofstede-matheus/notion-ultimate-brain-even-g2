import './styles.css'
import { installLogger } from './logger'
import { boot } from '../boot'

installLogger()

boot().catch(() => {})
