import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Evita que o scroll do mouse altere valores de inputs numéricos focados.
window.addEventListener(
  'wheel',
  () => {
    const elementoAtivo = document.activeElement

    if (
      elementoAtivo instanceof HTMLInputElement &&
      elementoAtivo.type === 'number'
    ) {
      elementoAtivo.blur()
    }
  },
  { passive: true },
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
