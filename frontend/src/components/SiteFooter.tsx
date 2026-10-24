import type { MouseEvent } from 'react';
import type { SectionId } from '../navigation';

interface Props {
  onNavigate: (id: SectionId) => void;
}

export default function SiteFooter({ onNavigate }: Props) {
  const go = (id: SectionId) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onNavigate(id);
  };

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">GeoVista</span>
          <p>Descubre el mundo, un destino a la vez.</p>
        </div>

        <nav className="footer-nav" aria-label="Pie de página">
          <a href="#inicio" onClick={go('inicio')}>
            Inicio
          </a>
          <a href="#lugares" onClick={go('lugares')}>
            Lugares
          </a>
          <a href="#destino" onClick={go('destino')}>
            Destino
          </a>
        </nav>

        <p className="footer-note">
          Fotografías y mapas de sus respectivos autores.
          <br />
          Hecho para curiosos.
        </p>
      </div>
    </footer>
  );
}
