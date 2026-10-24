import Icon from './ui/Icon';
import type { SectionId } from '../navigation';

interface Props {
  onLogoClick: () => void;
  onNavigate: (id: SectionId) => void;
}

// Cabecera editorial: marca, navegación mínima y un acceso directo al atlas.
// Los enlaces conservan href para funcionar sin JS; el handler solo suaviza.
export default function SiteHeader({ onLogoClick, onNavigate }: Props) {
  return (
    <header className="nav">
      <div className="nav-inner">
        <button
          type="button"
          className="brand"
          onClick={onLogoClick}
          aria-label="GeoVista, ir al inicio"
        >
          <span className="brand-mark">
            <img
              src="/logo.svg"
              className="brand-logo"
              alt=""
              width="25"
              height="25"
              aria-hidden="true"
            />
          </span>
          <span className="brand-copy">
            <span className="brand-name">GeoVista</span>
          </span>
        </button>

        <nav className="nav-links" aria-label="Principal">
          <a
            href="#inicio"
            onClick={(event) => {
              event.preventDefault();
              onNavigate('inicio');
            }}
          >
            Inicio
          </a>
          <a
            href="#lugares"
            onClick={(event) => {
              event.preventDefault();
              onNavigate('lugares');
            }}
          >
            Lugares
          </a>
          <a
            href="#destino"
            onClick={(event) => {
              event.preventDefault();
              onNavigate('destino');
            }}
          >
            Explorar
          </a>
        </nav>

        <a
          href="#destino"
          className="nav-cta"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('destino');
          }}
        >
          <Icon name="compass" size={14} />
          Abrir atlas
        </a>
      </div>
    </header>
  );
}
