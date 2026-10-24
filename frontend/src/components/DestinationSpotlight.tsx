import type { Place } from '../types';
import PlaceImage from './PlaceImage';
import Icon from './ui/Icon';

interface Props {
  selected: Place | null;
  isFav: boolean;
  onExplore: () => void;
  onRandom: () => void;
  onToggleFav: () => void;
}

export default function DestinationSpotlight({
  selected,
  isFav,
  onExplore,
  onRandom,
  onToggleFav,
}: Props) {
  return (
    <section id="destino" className="destino" aria-live="polite">
      {selected ? (
        <article key={selected.id} className="destino-card destino-enter">
          <div className="spotlight-media">
            <PlaceImage
              key={selected.id}
              place={selected}
              w={1200}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <span className="spotlight-index">Destino destacado</span>
          </div>

          <div className="spotlight-body">
            <div className="spotlight-kicker">
              <span className="chip">{selected.category}</span>
              <span>{selected.country}</span>
            </div>

            <h2>{selected.name}</h2>
            <p className="spotlight-desc">{selected.description}</p>

            <dl className="spotlight-facts">
              <div className="fact">
                <dt>Coordenadas</dt>
                <dd>
                  {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
                </dd>
              </div>
              <div className="fact">
                <dt>Experiencia</dt>
                <dd>
                  {selected.hasStreetView === false ? 'Galería fotográfica' : 'Street View 360°'}
                </dd>
              </div>
            </dl>

            <div className="spotlight-actions">
              <button type="button" className="btn btn-primary" onClick={onExplore}>
                <Icon name={selected.hasStreetView === false ? 'camera' : 'globe'} size={16} />
                {selected.hasStreetView === false ? 'Ver galería' : 'Vivir experiencia 360°'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={onRandom}>
                <Icon name="refresh" size={15} />
                Otro destino
              </button>
              <button
                type="button"
                className={`btn btn-ghost${isFav ? ' is-saved' : ''}`}
                onClick={onToggleFav}
                aria-pressed={isFav}
              >
                <Icon name="heart" size={15} filled={isFav} />
                {isFav ? 'En favoritos' : 'Guardar'}
              </button>
            </div>
          </div>
        </article>
      ) : (
        <div className="destino-empty">
          <span className="destino-empty-icon" aria-hidden="true">
            <Icon name="compass" size={27} />
          </span>
          <div className="destino-empty-copy">
            <p className="eyebrow">Tu próximo destino</p>
            <p className="destino-empty-title">El mundo está a un clic.</p>
            <p className="destino-empty-text">
              Pulsa <strong>Explorar</strong> para empezar la aventura.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={onRandom}>
            <Icon name="compass" size={16} />
            Explorar al azar
          </button>
        </div>
      )}
    </section>
  );
}
