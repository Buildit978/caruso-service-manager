import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './App.css'  
import App from './App.tsx'
import { SettingsAccessProvider } from './contexts/SettingsAccessContext'
import { AccessProvider } from './contexts/AccessContext'


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsAccessProvider>
        <AccessProvider>
          <App />
        </AccessProvider>
      </SettingsAccessProvider>
    </BrowserRouter>
  </StrictMode>,
)
