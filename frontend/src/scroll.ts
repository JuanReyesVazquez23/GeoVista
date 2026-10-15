// Scroll programático suave con duración y easing propios.
// El `behavior: 'smooth'` nativo lo controla el navegador (~300-500 ms,
// sin easing configurable) y se siente brusco; aquí usamos easeInOutCubic
// a 800-1000 ms para una desaceleración cinematográfica.

let rafId = 0;
let userInterrupted = false;

function onUserInterrupt() {
  userInterrupted = true;
}

function bindInterrupt() {
  userInterrupted = false;
  cancelAnimationFrame(rafId);
  window.addEventListener('wheel', onUserInterrupt, { passive: true, once: true });
  window.addEventListener('touchmove', onUserInterrupt, { passive: true, once: true });
  window.addEventListener('keydown', onUserInterrupt, { once: true });
}

function unbindInterrupt() {
  window.removeEventListener('wheel', onUserInterrupt);
  window.removeEventListener('touchmove', onUserInterrupt);
  window.removeEventListener('keydown', onUserInterrupt);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollToY(targetY: number, duration: number) {
  bindInterrupt();
  const startY = window.scrollY;
  const distance = targetY - startY;
  if (Math.abs(distance) < 2 || duration <= 0) {
    unbindInterrupt();
    window.scrollTo(0, targetY);
    return;
  }
  const start = performance.now();

  const step = (now: number) => {
    if (userInterrupted) {
      unbindInterrupt();
      return;
    }
    const elapsed = Math.min((now - start) / duration, 1);
    window.scrollTo(0, startY + distance * easeInOutCubic(elapsed));
    if (elapsed < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      unbindInterrupt();
    }
  };
  rafId = requestAnimationFrame(step);
}

export interface ScrollOptions {
  /** Duración en ms. Explorar: 900 (cinemático); paginación/nav: 700. */
  duration?: number;
  /** Desplazamiento extra en px (negativo para compensar el nav sticky). */
  offset?: number;
  /** 'start' = arriba de la sección; 'center' = centrada en viewport. */
  block?: 'start' | 'center';
}

export function smoothScrollToElement(el: HTMLElement, opts: ScrollOptions = {}) {
  const { duration = 800, offset = 0, block = 'start' } = opts;
  if (prefersReducedMotion()) {
    el.scrollIntoView({ behavior: 'auto', block });
    return;
  }
  const rect = el.getBoundingClientRect();
  const targetY =
    block === 'center'
      ? window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2 + offset
      : window.scrollY + rect.top + offset;
  scrollToY(targetY, duration);
}

export function smoothScrollToId(id: string, opts: ScrollOptions = {}) {
  const el = document.getElementById(id);
  if (el) smoothScrollToElement(el, opts);
  else document.querySelector(`a[href="#${id}"]`)?.scrollIntoView();
}
