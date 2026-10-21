import { useEffect, useState } from 'react';
import { applyServiceWorkerUpdate, registerServiceWorker } from '../pwa';

// Aviso no bloqueante de nueva versión. El SW espera a que el usuario acepte,
// así una pestaña abierta nunca mezcla index viejo con chunks nuevos.
export default function UpdatePrompt() {
  const [available, setAvailable] = useState(false);

  useEffect(() => registerServiceWorker(() => setAvailable(true)), []);

  if (!available) return null;

  return (
    <div className="install-pill update-pill" role="status">
      <span>✨ Nueva versión disponible</span>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => {
          setAvailable(false);
          applyServiceWorkerUpdate();
        }}
      >
        Actualizar
      </button>
      <button
        type="button"
        className="install-dismiss"
        onClick={() => setAvailable(false)}
        aria-label="Ahora no"
      >
        ✕
      </button>
    </div>
  );
}
