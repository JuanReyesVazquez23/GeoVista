import type { Place } from './types';

type Coords = Pick<Place, 'latitude' | 'longitude'>;

// URLs de Google construidas en un solo lugar (estaban repetidas en 3 sitios).
export function mapsSearchUrl(place: Coords): string {
  return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
}

export function earthUrl(place: Coords): string {
  return `https://earth.google.com/web/@${place.latitude},${place.longitude},500a,2000d,35y,0h,0t,0r`;
}
