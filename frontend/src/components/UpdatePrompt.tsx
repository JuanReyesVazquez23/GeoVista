import { useEffect, useState } from 'react';
import { applyServiceWorkerUpdate, registerServiceWorker } from '../pwa';
import Icon from './ui/Icon';

// Aviso no bloqueante de nueva versión. El SW espera a que el usuario acepte,
// así una pestaña abierta nunca mezcla index viejo con chunks nuevos.
export default function UpdatePrompt() {
  const [available, setAvailable] = useState(false);

  useEffect(() => registerServiceWorker(() => setAvailable(true)), []);

  if (!available) return null;

  return (
    <div className="install-pill update-pill" role="status">
      <span className="install-icon" aria-hidden="true">
        <Icon name="refresh" size={16} />
      </span>
      <span className="install-copy">
        <strong>Nueva versión disponible</strong>
        <small>Actualiza para ver los últimos cambios.</small>
      </span>
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
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
