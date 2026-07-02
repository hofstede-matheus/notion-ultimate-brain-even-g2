import './web/styles.css'
import { installLogger } from './web/logger'
import { boot } from './boot'

installLogger()
console.log('[notion-ultimate-brain] app starting')

boot().catch((err) => {
  console.error('[notion-ultimate-brain] fatal init error', err)
})
