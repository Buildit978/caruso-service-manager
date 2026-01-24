import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './App.css'  
import App from './App.tsx'
import { SettingsAccessProvider } from './contexts/SettingsAccessContext'
import { AccessProvider } from './contexts/AccessContext'

// Production-only: purge legacy dev token keys from localStorage
if (!import.meta.env.DEV) {
  localStorage.removeItem('csm_token_owner');
  localStorage.removeItem('csm_token_manager');
  localStorage.removeItem('csm_token_technician');
}

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
