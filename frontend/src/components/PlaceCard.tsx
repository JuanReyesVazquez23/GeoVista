import { memo } from 'react';
import type { Place } from '../types';
import { mapsSearchUrl } from '../maps';
import PlaceImage from './PlaceImage';
import Icon from './ui/Icon';

interface Props {
  place: Place;
  onExplore: (place: Place) => void;
  isFav: boolean;
  onToggleFav: (id: string) => void;
}

// memo: evita re-renderizar las tarjetas cuando App re-renderiza por spinner,
// modal o cambio de página sin que cambien sus props.
function PlaceCard({ place, onExplore, isFav, onToggleFav }: Props) {
  return (
    <article className="card reveal">
      <div className="card-media">
        <PlaceImage
          key={place.id}
          place={place}
          w={720}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <span className="card-media-shade" aria-hidden="true" />
        <span className="chip">{place.category}</span>
        <button
          type="button"
          className={`fav-btn${isFav ? ' active' : ''}`}
          onClick={() => onToggleFav(place.id)}
          aria-pressed={isFav}
          aria-label={
            isFav ? `Quitar ${place.name} de favoritos` : `Guardar ${place.name} en favoritos`
          }
        >
          <Icon name="heart" size={16} filled={isFav} />
        </button>
        {place.hasStreetView !== false && (
          <span className="card-badge">
            <Icon name="globe" size={11} />
            360°
          </span>
        )}
      </div>

      <div className="card-body">
        <div className="card-kicker">
          <span className="card-country">{place.country}</span>
          <span className="card-kicker-dot" aria-hidden="true" />
          <span className="card-coords">
            {place.latitude.toFixed(2)}, {place.longitude.toFixed(2)}
          </span>
        </div>

        <h3>{place.name}</h3>
        <p className="card-desc">{place.description}</p>

        <div className="card-actions">
          <button type="button" className="card-link" onClick={() => onExplore(place)}>
            Explorar
            <Icon name="arrow-up-right" size={13} />
          </button>
          <a
            className="card-map"
            href={mapsSearchUrl(place)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Abrir ${place.name} en Google Maps`}
          >
            <Icon name="map-pin" size={13} />
            Maps
          </a>
        </div>
      </div>
    </article>
  );
}

export default memo(PlaceCard);
