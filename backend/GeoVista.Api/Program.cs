using System.Text.Json;
using GeoVista.Api.Data;
using GeoVista.Api.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Orígenes del frontend: locales en dev + dominios de producción (env FRONTEND_URL).
var frontendOrigins = new List<string> { "http://localhost:5173", "http://localhost:3000" };
var extraOrigins = Environment.GetEnvironmentVariable("FRONTEND_URL")?.Split(
    ',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
if (extraOrigins is not null)
{
    frontendOrigins.AddRange(extraOrigins);
}

// CORS abierto para el frontend.
builder.Services.AddCors(options =>
{
    options.AddPolicy("GeoVistaWeb", policy =>
        policy.WithOrigins([.. frontendOrigins])
              .AllowAnyHeader()
              .AllowAnyMethod());
});

builder.Services.AddResponseCompression(options =>
{
    // Comprime también en HTTPS (en producción siempre es HTTPS).
    options.EnableForHttps = true;
});

builder.Services.AddOpenApi();

// SQLite en App_Data. El contrato no cambia: React ni se entera del origen.
var dbPath = Path.Combine(builder.Environment.ContentRootPath, "App_Data", "geovista.db");
builder.Services.AddDbContext<GeoVistaDb>(options => options.UseSqlite($"Data Source={dbPath}"));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseResponseCompression();

app.UseCors("GeoVistaWeb");

// places.json: semilla inicial de la DB + respaldo si SQLite no tiene escritura.
var jsonPath = Path.Combine(app.Environment.ContentRootPath, "Data", "places.json");
var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
List<Place> memoryPlaces;
try
{
    var json = await File.ReadAllTextAsync(jsonPath);
    memoryPlaces = JsonSerializer.Deserialize<List<Place>>(json, jsonOptions)
        ?? throw new InvalidOperationException("places.json está vacío o es inválido.");
}
catch (FileNotFoundException ex)
{
    throw new InvalidOperationException($"No se encontró {jsonPath}.", ex);
}

var useDb = false;
try
{
    Directory.CreateDirectory(Path.GetDirectoryName(dbPath)!);
    using var scope = app.Services.CreateScope();
    var init = scope.ServiceProvider.GetRequiredService<GeoVistaDb>();
    init.Database.EnsureCreated();
    // Upsert por Id: el JSON manda siempre, así los cambios de coordenadas
    // y lugares nuevos se propagan aunque la DB ya exista.
    var existingIds = init.Places
        .AsNoTracking()
        .Select(p => p.Id)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);
    foreach (var place in memoryPlaces)
    {
        if (existingIds.Contains(place.Id))
            init.Places.Update(place);
        else
            init.Places.Add(place);
    }
    init.SaveChanges();
    useDb = true;
    app.Logger.LogInformation("SQLite activa con {Count} lugares.", init.Places.Count());
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "SQLite no disponible; se usa places.json en memoria.");
}

// Filtro por categoría con == y ToLower: traducen a SQL y a objetos por igual.
IQueryable<Place> Query(GeoVistaDb db, string? category)
{
    IQueryable<Place> query = useDb ? db.Places.AsNoTracking() : memoryPlaces.AsQueryable();
    if (!string.IsNullOrWhiteSpace(category) &&
        !string.Equals(category.Trim(), "Todas", StringComparison.OrdinalIgnoreCase))
    {
        var wanted = category.Trim().ToLowerInvariant();
        query = query.Where(p => p.Category.ToLower() == wanted);
    }
    return query;
}

app.MapGet("/api/places", (HttpContext http, GeoVistaDb db, int? page, int? pageSize, string? category) =>
{
    // El catálogo casi no cambia: el navegador reutiliza cada página 1 hora.
    // La query es parte de la clave de caché, así que cada página se cachea aparte.
    http.Response.Headers.CacheControl = "public,max-age=3600";

    var pool = Query(db, category).ToList();

    // Sin parámetros: compatibilidad, devuelve el array completo.
    if (page is null && pageSize is null)
    {
        return Results.Ok(pool);
    }

    var currentPage = page.GetValueOrDefault(1);
    var size = pageSize.GetValueOrDefault(12);
    if (currentPage < 1 || size is < 1 or > 50)
    {
        return Results.BadRequest("page debe ser >= 1 y pageSize estar entre 1 y 50.");
    }

    var totalPages = (int)Math.Ceiling(pool.Count / (double)size);
    var items = pool.Skip((currentPage - 1) * size).Take(size).ToList();

    return Results.Ok(new PagedResult<Place>(items, currentPage, size, pool.Count, totalPages));
})
.WithName("GetPlaces")
.WithSummary("Devuelve lugares: array completo o página { items, page, totalPages } con ?page=&pageSize=&category=.");

app.MapGet("/api/places/categories", (HttpContext http, GeoVistaDb db) =>
{
    http.Response.Headers.CacheControl = "public,max-age=3600";
    var categories = Query(db, null)
        .Select(p => p.Category)
        .Distinct()
        .OrderBy(c => c)
        .ToList();
    return Results.Ok(categories);
})
.WithName("GetCategories")
.WithSummary("Devuelve las categorías disponibles.");

app.MapGet("/api/places/random", (HttpContext http, GeoVistaDb db, string? category) =>
{
    // NUNCA se cachea: cada llamada debe sortear de nuevo.
    http.Response.Headers.CacheControl = "no-store";
    // Búsqueda al azar con filtro opcional por categoría (?category=Montaña).
    var pool = Query(db, category).ToList();

    if (pool.Count == 0)
    {
        return Results.NotFound($"No hay lugares en la categoría '{category}'.");
    }

    return Results.Ok(pool[Random.Shared.Next(pool.Count)]);
})
.WithName("GetRandomPlace")
.WithSummary("Devuelve un lugar aleatorio, opcionalmente de una categoría.");

app.MapGet("/api/places/{id}", (HttpContext http, GeoVistaDb db, string id) =>
{
    http.Response.Headers.CacheControl = "public,max-age=3600";
    if (string.IsNullOrWhiteSpace(id))
    {
        return Results.BadRequest("El id no puede estar vacío.");
    }

    var lowered = id.Trim().ToLowerInvariant();
    var place = Query(db, null).FirstOrDefault(p => p.Id.ToLower() == lowered);

    return place is null ? Results.NotFound() : Results.Ok(place);
})
.WithName("GetPlaceById")
.WithSummary("Devuelve un lugar por su id.");

// Puerto inyectado por el hosting ($PORT en contenedores; IIS lo ignora).
var port = Environment.GetEnvironmentVariable("PORT");
if (string.IsNullOrWhiteSpace(port))
{
    app.Run();
}
else
{
    app.Run($"http://0.0.0.0:{port}");
}
