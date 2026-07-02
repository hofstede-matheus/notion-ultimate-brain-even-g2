import './web/styles.css'
import { installLogger } from './web/logger'
import { boot } from './boot'

installLogger()

boot().catch(() => {})
