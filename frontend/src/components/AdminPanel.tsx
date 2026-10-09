import { useMemo, useState } from 'react';
import type { Place } from '../types';
import { ApiError, createPlace, deletePlace, updatePlace } from '../api/placesApi';

interface Props {
  places: Place[];
  adminKey: string;
  onKeyChange: (key: string) => void;
  onSaved: () => Promise<void>;
  onClose: () => void;
}

const EMPTY: Place = {
  id: '',
  name: '',
  country: '',
  category: 'Monumento',
  description: '',
  latitude: 0,
  longitude: 0,
  imageUrl: '',
  googleMapsUrl: '',
  hasStreetView: true,
};

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Panel de administración (acceso por easter egg): altas, bajas y edición.
// Todos los errores del backend se muestran tal cual (validación, 403, 404, 409).
export default function AdminPanel({ places, adminKey, onKeyChange, onSaved, onClose }: Props) {
  const [draft, setDraft] = useState<Place | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [idTouched, setIdTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');

  const categories = useMemo(
    () => Array.from(new Set(places.map((p) => p.category))).sort(),
    [places],
  );

  if (!adminKey) {
    return (
      <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Acceso administrador">
        <div className="modal admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-head">
            <h2>🔐 Administración</h2>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>
          <p className="modal-desc">Introduce la clave de administrador (variable ADMIN_KEY del backend).</p>
          <form
            className="admin-key-form"
            onSubmit={(e) => {
              e.preventDefault();
              onKeyChange(keyInput.trim());
            }}
          >
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Clave de administrador"
              aria-label="Clave de administrador"
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!keyInput.trim()}>
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  const set = (patch: Partial<Place>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  const startNew = () => {
    setDraft({ ...EMPTY });
    setIsNew(true);
    setIdTouched(false);
    setError(null);
  };

  const startEdit = (place: Place) => {
    setDraft({ ...place });
    setIsNew(false);
    setIdTouched(true);
    setError(null);
    setConfirmDelete(null);
  };

  const save = async () => {
    if (!draft) return;
    setError(null);
    setBusy(true);
    try {
      if (isNew) await createPlace(draft, adminKey);
      else await updatePlace(draft, adminKey);
      await onSaved();
      setDraft(null);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : 'Error de red.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      await deletePlace(id, adminKey);
      setConfirmDelete(null);
      await onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : 'Error de red.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Administrar lugares">
      <div className="modal admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-head">
          <h2>🛠️ Lugares ({places.length})</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}

        {draft ? (
          <div className="admin-grid">
            <label className="field">
              <span>Nombre *</span>
              <input
                value={draft.name}
                onChange={(e) => {
                  const name = e.target.value;
                  set({ name });
                  if (isNew && !idTouched) set({ id: slugify(name) });
                }}
              />
            </label>
            <label className="field">
              <span>Id * {isNew ? '(se genera del nombre)' : '(no editable)'}</span>
              <input
                value={draft.id}
                disabled={!isNew}
                onChange={(e) => {
                  setIdTouched(true);
                  set({ id: slugify(e.target.value) });
                }}
              />
            </label>
            <label className="field">
              <span>País *</span>
              <input value={draft.country} onChange={(e) => set({ country: e.target.value })} />
            </label>
            <label className="field">
              <span>Categoría *</span>
              <input
                value={draft.category}
                list="admin-categories"
                onChange={(e) => set({ category: e.target.value })}
              />
              <datalist id="admin-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="field field-wide">
              <span>Descripción</span>
              <textarea
                rows={3}
                value={draft.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Latitud *</span>
              <input
                type="number"
                step="any"
                value={Number.isFinite(draft.latitude) ? draft.latitude : ''}
                onChange={(e) => set({ latitude: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>Longitud *</span>
              <input
                type="number"
                step="any"
                value={Number.isFinite(draft.longitude) ? draft.longitude : ''}
                onChange={(e) => set({ longitude: e.target.value ? Number(e.target.value) : draft.longitude })}
              />
            </label>
            <label className="field field-wide">
              <span>Imagen (URL en línea) *</span>
              <input value={draft.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} />
            </label>
            <label className="field field-wide">
              <span>Google Maps (URL) *</span>
              <input value={draft.googleMapsUrl} onChange={(e) => set({ googleMapsUrl: e.target.value })} />
            </label>
            <label className="field-check">
              <input
                type="checkbox"
                checked={draft.hasStreetView !== false}
                onChange={(e) => set({ hasStreetView: e.target.checked })}
              />
              <span>Tiene Street View (si no, se muestra galería)</span>
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
                {busy ? 'Guardando…' : isNew ? 'Agregar lugar' : 'Guardar cambios'}
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setDraft(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
                ＋ Agregar lugar
              </button>
            </div>
            <ul className="admin-list">
              {places.map((p) => (
                <li key={p.id} className="admin-row">
                  <div>
                    <strong>{p.name}</strong>
                    <p className="admin-meta">
                      {p.country} · {p.category} · {p.latitude.toFixed(2)}, {p.longitude.toFixed(2)}
                      {p.hasStreetView === false ? ' · 📷' : ''}
                    </p>
                  </div>
                  {confirmDelete === p.id ? (
                    <div className="card-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => remove(p.id)}
                      >
                        Sí, eliminar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => setConfirmDelete(null)}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="card-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setConfirmDelete(p.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
