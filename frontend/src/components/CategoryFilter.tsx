import Icon from './ui/Icon';

interface Props {
  categories: string[];
  category: string;
  favOnly: boolean;
  favoritesCount: number;
  onCategory: (category: string) => void;
  onToggleFavorites: () => void;
}

// Filtros del hero. Mantiene los nombres accesibles exactos de cada categoría
// y el estado aria-pressed de favoritos.
export default function CategoryFilter({
  categories,
  category,
  favOnly,
  favoritesCount,
  onCategory,
  onToggleFavorites,
}: Props) {
  return (
    <div className="hero-categories">
      <span className="filter-label">Filtrar por</span>
      <div className="pills" role="group" aria-label="Explorar por categoría">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            className={`pill${item === category && !favOnly ? ' active' : ''}`}
            onClick={() => onCategory(item)}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          className={`pill${favOnly ? ' active' : ''}`}
          onClick={onToggleFavorites}
          aria-pressed={favOnly}
        >
          <Icon name="heart" size={12} filled={favOnly} />
          Favoritos{favoritesCount > 0 ? ` (${favoritesCount})` : ''}
        </button>
      </div>
    </div>
  );
}
