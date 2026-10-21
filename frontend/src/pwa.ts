// Registro del service worker y detección de actualizaciones.
// En desarrollo no se registra: el SW solo existe en el build de producción.
//
// Flujo de actualización:
//  1. El SW nuevo se instala y queda en estado "waiting" (no hace skipWaiting).
//  2. La app avisa con una píldora "Nueva versión disponible".
//  3. Al pulsar Actualizar se envía SKIP_WAITING; el SW activa, toma el control
//     y "controllerchange" recarga una sola vez para servir los assets nuevos.

let waitingWorker: ServiceWorker | null = null;
let reloading = false;
let started = false;

type UpdateListener = () => void;

export function registerServiceWorker(onUpdate: UpdateListener): () => void {
  if (started || !import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return () => {};
  }
  started = true;

  const onControllerChange = () => {
    if (reloading) window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

  const track = (registration: ServiceWorkerRegistration) => {
    // Actualización ya instalada en una visita anterior.
    if (registration.waiting && navigator.serviceWorker.controller) {
      waitingWorker = registration.waiting;
      onUpdate();
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        // "installed" + controlador actual = hay versión nueva esperando.
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = registration.waiting ?? installing;
          onUpdate();
        }
      });
    });
  };

  navigator.serviceWorker
    .register('/sw.js')
    .then(track)
    .catch(() => {
      // Sin SW la app sigue funcionando online; no es un error bloqueante.
    });

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    started = false;
  };
}

export function applyServiceWorkerUpdate(): void {
  if (!waitingWorker) return;
  reloading = true;
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}
