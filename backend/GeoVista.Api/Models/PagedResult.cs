namespace GeoVista.Api.Models;

// Sobre de paginación para /api/places?page=&pageSize=.
// Por qué record genérico: reutilizable y se serializa a { items, page, ... }.
public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages
);
