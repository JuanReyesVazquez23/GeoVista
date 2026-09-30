import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const VISITS_KEY = 'gv-visits';
const DISMISSED_KEY = 'gv-install-dismissed';
const INSTALLED_KEY = 'gv-installed';
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const POLITE_DELAY = 5000;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// Aviso de instalación que no molesta: solo aparece si el navegador lo permite
// (beforeinstallprompt), tras 5 s, desde la 2ª visita, como píldora descartable
// que no vuelve en 30 días. Nunca es un popup bloqueante.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    const at = Number(localStorage.getItem(DISMISSED_KEY) ?? '0');
    return Date.now() - at < THIRTY_DAYS;
  });
  const [done, setDone] = useState(
    () => isStandalone() || localStorage.getItem(INSTALLED_KEY) === '1',
  );

  useEffect(() => {
    if (done) return;
    const visits = Number(localStorage.getItem(VISITS_KEY) ?? '0') + 1;
    localStorage.setItem(VISITS_KEY, String(visits));

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, '1');
      setDone(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    const timer = window.setTimeout(() => setReady(true), POLITE_DELAY);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
      window.clearTimeout(timer);
    };
  }, [done]);

  if (done || dismissed || !ready || !deferred) return null;
  if (Number(localStorage.getItem(VISITS_KEY) ?? '0') < 2) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  };
  const install = async () => {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      localStorage.setItem(INSTALLED_KEY, '1');
      setDone(true);
    }
    setDeferred(null);
  };

  return (
    <div className="install-pill" role="dialog" aria-label="Instalar GeoVista">
      <span>📲 Lleva GeoVista contigo</span>
      <button type="button" className="btn btn-primary btn-sm" onClick={install}>
        Instalar
      </button>
      <button type="button" className="install-dismiss" onClick={dismiss} aria-label="Ahora no">
        ✕
      </button>
    </div>
  );
}
