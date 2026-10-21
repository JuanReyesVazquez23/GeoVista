import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'

// El service worker se registra desde <UpdatePrompt /> (solo en producción).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      fallback={
        <div className="app-error" role="alert">
          <h1>Algo salió mal</h1>
          <p>
            No se pudo cargar esta parte de GeoVista. Revisa tu conexión e inténtalo de nuevo.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      }
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
