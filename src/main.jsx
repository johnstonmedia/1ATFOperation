import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { DataProvider } from './context/DataContext'
import { AuthProvider } from './context/AuthContext'
import { CompanyProvider } from './context/CompanyContext'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'
import ErrorBoundary from './components/ErrorBoundary'

// On GitHub Pages the app is served from /<repo>/. Vite exposes that as
// BASE_URL; React Router needs it (without the trailing slash) as basename.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={basename}>
        <DataProvider>
          <AuthProvider>
            <CompanyProvider>
              <ToastProvider>
                <ConfirmProvider>
                  <App />
                </ConfirmProvider>
              </ToastProvider>
            </CompanyProvider>
          </AuthProvider>
        </DataProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
