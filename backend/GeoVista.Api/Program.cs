using System.Text.Json;
using GeoVista.Api.Models;

var builder = WebApplication.CreateBuilder(args);

// CORS abierto para el frontend Vite en desarrollo.
builder.Services.AddCors(options =>
{
    options.AddPolicy("GeoVistaWeb", policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

builder.Services.AddResponseCompression(options =>
{
    // Comprime también en HTTPS (en producción siempre es HTTPS).
    options.EnableForHttps = true;
});

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseResponseCompression();

app.UseCors("GeoVistaWeb");

// Carga única de places.json en memoria (por qué: dataset pequeño, evita I/O por request).
var jsonPath = Path.Combine(app.Environment.ContentRootPath, "Data", "places.json");
var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
List<Place> places;
try
{
    var json = await File.ReadAllTextAsync(jsonPath);
    places = JsonSerializer.Deserialize<List<Place>>(json, jsonOptions)
        ?? throw new InvalidOperationException("places.json está vacío o es inválido.");
}
catch (FileNotFoundException ex)
{
    throw new InvalidOperationException($"No se encontró {jsonPath}.", ex);
}

app.MapGet("/api/places", (HttpContext http) =>
{
    // El catálogo casi no cambia: el navegador lo reutiliza 1 hora sin re-descargar.
    http.Response.Headers.CacheControl = "public,max-age=3600";
    return Results.Ok(places);
})
.WithName("GetPlaces")
.WithSummary("Devuelve todos los lugares de GeoVista.");

app.MapGet("/api/places/categories", (HttpContext http) =>
{
    http.Response.Headers.CacheControl = "public,max-age=3600";
    var categories = places
        .Select(p => p.Category)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .Order()
        .ToList();
    return Results.Ok(categories);
})
.WithName("GetCategories")
.WithSummary("Devuelve las categorías disponibles.");

app.MapGet("/api/places/random", (HttpContext http, string? category) =>
{
    // NUNCA se cachea: cada llamada debe sortear de nuevo.
    http.Response.Headers.CacheControl = "no-store";
    // Búsqueda al azar con filtro opcional por categoría (?category=Montaña).
    var pool = string.IsNullOrWhiteSpace(category)
        ? places
        : places
            .Where(p => string.Equals(p.Category, category.Trim(), StringComparison.OrdinalIgnoreCase))
            .ToList();

    if (pool.Count == 0)
    {
        return Results.NotFound($"No hay lugares en la categoría '{category}'.");
    }

    return Results.Ok(pool[Random.Shared.Next(pool.Count)]);
})
.WithName("GetRandomPlace")
.WithSummary("Devuelve un lugar aleatorio, opcionalmente de una categoría.");

app.MapGet("/api/places/{id}", (HttpContext http, string id) =>
{
    http.Response.Headers.CacheControl = "public,max-age=3600";
    if (string.IsNullOrWhiteSpace(id))
    {
        return Results.BadRequest("El id no puede estar vacío.");
    }

    var place = places.FirstOrDefault(p =>
        string.Equals(p.Id, id, StringComparison.OrdinalIgnoreCase));

    return place is null ? Results.NotFound() : Results.Ok(place);
})
.WithName("GetPlaceById")
.WithSummary("Devuelve un lugar por su id.");

app.Run();
