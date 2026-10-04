interface Props {
  current: number;
  total: number;
  placeName: string;
  playing: boolean;
  stepMs: number;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  onExit: () => void;
}

// Barra de control del modo tour: fija, compacta y descartable con ✕.
export default function TourBar({
  current,
  total,
  placeName,
  playing,
  stepMs,
  onPrev,
  onNext,
  onToggle,
  onExit,
}: Props) {
  return (
    <div className="tour-bar" role="region" aria-label="Modo tour">
      <span className="tour-count">
        {current}/{total}
      </span>
      <span className="tour-name">{placeName}</span>
      <button type="button" className="tour-btn" onClick={onPrev} disabled={current <= 1} aria-label="Parada anterior">
        ⏮
      </button>
      <button type="button" className="tour-btn" onClick={onToggle} aria-label={playing ? 'Pausar tour' : 'Continuar tour'}>
        {playing ? '⏸' : '▶'}
      </button>
      <button type="button" className="tour-btn" onClick={onNext} disabled={current >= total} aria-label="Parada siguiente">
        ⏭
      </button>
      <button type="button" className="tour-btn" onClick={onExit} aria-label="Salir del tour">
        ✕
      </button>
      <div className="tour-progress" aria-hidden="true">
        <span
          key={current}
          style={{ animationDuration: `${stepMs}ms`, animationPlayState: playing ? 'running' : 'paused' }}
        />
      </div>
    </div>
  );
}
