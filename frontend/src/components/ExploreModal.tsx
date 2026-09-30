import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Place } from '../types';
import PlaceImage from './PlaceImage';

interface Props {
  place: Place;
  onClose: () => void;
  onRandom: () => void;
}

type View = 'street' | 'map' | 'photo';

// Experiencia 360°: Street View a nivel de calle + mapa + enlaces externos.
// El truco clave: q vacío + layer=c + cbll + cbp fuerza el modo calle.
// (Con q=lat,lng Google ignora layer=c y muestra el mapa desde arriba.)
// No requiere API key: usa los endpoints públicos output=embed de Google Maps.
export default function ExploreModal({ place, onClose, onRandom }: Props) {
  // Política GeoVista: sin cobertura Street View → vista fotográfica, no iframe roto.
  const hasStreetView = place.hasStreetView !== false;
  const [view, setView] = useState<View>(hasStreetView ? 'street' : 'photo');

  useEffect(() => {
    setView(place.hasStreetView === false ? 'photo' : 'street');
  }, [place.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const mapEmbed = `https://www.google.com/maps?q=${place.latitude},${place.longitude}&z=16&output=embed`;
  const streetEmbed = `https://maps.google.com/maps?q=&layer=c&cbll=${place.latitude},${place.longitude}&cbp=11,0,0,0,0&output=svembed`;
  const panoLink =
    place.googleMapsUrl ||
    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${place.latitude},${place.longitude}`;

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Explorar ${place.name}`}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, y: 48, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.98 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-hero">
          <PlaceImage place={place} referrerPolicy="no-referrer" />
          <div className="modal-hero-text">
            <span className="chip">{place.category}</span>
            <h2>{place.name}</h2>
            <p>
              {place.country} · {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <p className="modal-desc">{place.description}</p>

        <div className="view-tabs" role="tablist" aria-label="Vista">
          {hasStreetView ? (
            <button
              type="button"
              role="tab"
              aria-selected={view === 'street'}
              className={`tab${view === 'street' ? ' active' : ''}`}
              onClick={() => setView('street')}
            >
              🚶 Street View 360°
            </button>
          ) : (
            <button
              type="button"
              role="tab"
              aria-selected={view === 'photo'}
              className={`tab${view === 'photo' ? ' active' : ''}`}
              onClick={() => setView('photo')}
            >
              📷 Vista fotográfica
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={view === 'map'}
            className={`tab${view === 'map' ? ' active' : ''}`}
            onClick={() => setView('map')}
          >
            🗺 Mapa
          </button>
        </div>

        <div className="embed-single">
          {view === 'photo' ? (
            <div className="photo-view">
              <PlaceImage
                key={`ph-${place.id}`}
                place={place}
                w={1600}
                referrerPolicy="no-referrer"
              />
              <p className="embed-hint">
                📷 Esta zona no tiene cobertura Street View: disfruta la vista fotográfica
                y ubícala en el mapa.
              </p>
            </div>
          ) : view === 'street' ? (
            <iframe
              key={`sv-${place.id}`}
              title={`Street View de ${place.name}`}
              src={streetEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <iframe
              key={`map-${place.id}`}
              title={`Mapa de ${place.name}`}
              src={mapEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          )}
          <p className="embed-hint">
            Arrastra para girar en 360°. Si el Street View no carga dentro de la página,{' '}
            <a href={panoLink} target="_blank" rel="noreferrer">
              ábrelo en Google Maps
            </a>
            .
          </p>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onRandom}>
            🎲 Explorar otro lugar
          </button>
          {hasStreetView ? (
            <a className="btn btn-ghost" href={panoLink} target="_blank" rel="noreferrer">
              Abrir 360° en Google Maps
            </a>
          ) : (
            <a
              className="btn btn-ghost"
              href={`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir en Google Maps
            </a>
          )}
          <a
            className="btn btn-ghost"
            href={`https://earth.google.com/web/@${place.latitude},${place.longitude},500a,2000d,35y,0h,0t,0r`}
            target="_blank"
            rel="noreferrer"
          >
            Ver en Google Earth
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
