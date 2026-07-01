import './styles.css'
import { initApp } from './app'

initApp().catch((err) => {
  console.error('[notion-ultimate-brain] fatal init error', err)
})
