import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import DiagnosisDashboard from './components/DiagnosisDashboard.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DiagnosisDashboard />
  </StrictMode>,
)
