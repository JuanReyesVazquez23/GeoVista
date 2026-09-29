namespace GeoVista.Api.Models;

// Por qué record: DTO inmutable, ideal para respuestas de API.
public sealed record Place(
    string Id,
    string Name,
    string Country,
    string Category,
    string Description,
    double Latitude,
    double Longitude,
    string ImageUrl,
    string GoogleMapsUrl
);
