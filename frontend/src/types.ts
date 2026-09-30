export interface Place {
  id: string;
  name: string;
  country: string;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  googleMapsUrl: string;
  // false = sin cobertura Street View → el modal muestra vista fotográfica.
  hasStreetView?: boolean;
}

// Espejo del record PagedResult<T> del backend (serializado en camelCase).
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
