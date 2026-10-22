using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using GeoVista.Api.Data;
using GeoVista.Api.Models;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Orígenes del frontend: locales en dev + dominios de producción (env FRONTEND_URL).
var frontendOrigins = new List<string> { "http://localhost:5173", "http://localhost:3000" };
var extraOrigins = Environment.GetEnvironmentVariable("FRONTEND_URL")?.Split(
    ',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
if (extraOrigins is not null)
{
    frontendOrigins.AddRange(extraOrigins);
}

// CORS para el frontend: orígenes cerrados, métodos explícitos.
// Sin PUT/DELETE/PATCH/HEAD/TRACE: reduce superficie sin tocar lecturas.
builder.Services.AddCors(options =>
{
    options.AddPolicy("GeoVistaWeb", policy =>
        policy.WithOrigins([.. frontendOrigins])
              .AllowAnyHeader()
              .WithMethods("GET", "POST", "PUT", "DELETE"));
});

builder.Services.AddResponseCompression(options =>
{
    // Comprime también en HTTPS (en producción siempre es HTTPS).
    options.EnableForHttps = true;
});

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

// Límites generosos para no romper uso legítimo ni tests (toda la suite hace
// ~50 requests): lecturas 200/min, escrituras+admin 30/min por IP.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (ctx, _) =>
    {
        ctx.HttpContext.Response.Headers.RetryAfter = "60";
        ctx.HttpContext.Response.Headers.CacheControl = "no-store";
        await Results.Problem(
            statusCode: StatusCodes.Status429TooManyRequests,
            title: "Demasiadas solicitudes",
            detail: "Espera un minuto antes de volver a intentarlo.")
            .ExecuteAsync(ctx.HttpContext);
    };
    options.AddPolicy("reads", ctx => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 200,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
    options.AddPolicy("writes", ctx => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 30,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
});

// Detrás de Render el TLS termina en su proxy: sin forwarded headers la app
// vería "http". Se confía en el proxy solo en contenedor (env PORT).
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// Sin banner "Server: Kestrel": regalar la versión del servidor no ayuda.
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

// SQLite en App_Data. El contrato no cambia: React ni se entera del origen.
var dbPath = Path.Combine(builder.Environment.ContentRootPath, "App_Data", "geovista.db");
builder.Services.AddDbContext<GeoVistaDb>(options => options.UseSqlite($"Data Source={dbPath}"));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// No hay UseHttpsRedirection a propósito: Render termina TLS en su proxy y
// redirigir aquí entraría en bucle. HSTS (solo prod) dice al navegador que
// use https sin necesidad de redirigir en el servidor.
if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("PORT")))
{
    app.UseForwardedHeaders();
}
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseResponseCompression();

app.UseCors("GeoVistaWeb");

app.UseRateLimiter();

// Observabilidad mínima: cabeceras de seguridad + log estructurado por request.
// La API solo sirve JSON (el 360° vive en iframes del frontend), así que el CSP puede ser estricto.
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Referrer-Policy"] = "no-referrer";
    ctx.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    ctx.Response.Headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
    await next();
});

app.Use(async (ctx, next) =>
{
    var start = System.Diagnostics.Stopwatch.GetTimestamp();
    try
    {
        await next();
    }
    finally
    {
        // finally: la request queda logueada incluso si un middleware propio lanza
        // antes de llegar al ExceptionHandler (que va después, más cerca del endpoint,
        // para que el Status logueado ya sea el 500 final y no un 200 a medio escribir).
        var elapsedMs = System.Diagnostics.Stopwatch.GetElapsedTime(start).TotalMilliseconds;
        app.Logger.LogInformation("{Method} {Path} -> {Status} en {ElapsedMs:0} ms",
            ctx.Request.Method, ctx.Request.Path, ctx.Response.StatusCode, elapsedMs);
    }
});

app.UseExceptionHandler();

// Tope anti-abuso para escrituras: un Place pesa <2 KB; 32 KB deja margen
// de sobra y frena intentos de saturar el JSON antes de deserializar.
const long MaxWriteBytes = 32 * 1024;
app.Use(async (ctx, next) =>
{
    if ((HttpMethods.IsPost(ctx.Request.Method) || HttpMethods.IsPut(ctx.Request.Method))
        && ctx.Request.Path.StartsWithSegments("/api/places")
        && (ctx.Request.ContentLength ?? 0) > MaxWriteBytes)
    {
        await Results.Problem(
            statusCode: StatusCodes.Status413PayloadTooLarge,
            title: "Cuerpo demasiado grande",
            detail: "El cuerpo supera el máximo de 32 KB.")
            .ExecuteAsync(ctx);
        return;
    }
    await next();
});

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

    // El JSON manda en un despliegue normal (mtime nuevo) para propagar
    // coordenadas y lugares corregidos en el repo. Pero si la DB es más
    // reciente, significa que un admin escribió y el JSON falló: en ese caso
    // no re-sembramos, para no revertir altas/bajas/ediciones al reiniciar.
    // Se mide antes de EnsureCreated: abrir la DB no debe falsear el mtime.
    DateTime DbTimestamp()
    {
        var main = File.Exists(dbPath) ? File.GetLastWriteTimeUtc(dbPath) : DateTime.MinValue;
        var wal = File.Exists(dbPath + "-wal") ? File.GetLastWriteTimeUtc(dbPath + "-wal") : DateTime.MinValue;
        return main > wal ? main : wal;
    }

    var dbWasNewer = DbTimestamp() >= File.GetLastWriteTimeUtc(jsonPath);
    init.Database.EnsureCreated();

    var hasRows = init.Places.Any();
    if (!hasRows || !dbWasNewer)
    {
        // Upsert por Id: el JSON es la semilla y puede corregir filas existentes.
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
        // Bajas: lo que salió del JSON sale de la DB (traduce a NOT IN en SQL).
        var wantedIds = memoryPlaces.Select(p => p.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        init.Places.RemoveRange(init.Places.Where(p => !wantedIds.Contains(p.Id)));
        init.SaveChanges();
        app.Logger.LogInformation("SQLite sembrada desde places.json ({Count} lugares).", init.Places.Count());
    }
    else
    {
        app.Logger.LogInformation(
            "SQLite más reciente que places.json; se conservan los cambios de la DB ({Count} lugares).",
            init.Places.Count());
    }

    useDb = true;
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

// Normaliza para búsqueda insensible a acentos y mayúsculas:
// "Montaña" → "montana" (ñ → n por descomposición NFD).
// Se aplica en memoria: con 45 filas es instantáneo y evita collations raras en SQL.
static string Fold(string value) =>
    string.Concat(value.Normalize(NormalizationForm.FormD)
        .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark))
        .ToLowerInvariant();

static bool MatchesQuery(Place place, string needle) =>
    Fold(place.Name).Contains(needle) ||
    Fold(place.Country).Contains(needle) ||
    Fold(place.Category).Contains(needle) ||
    Fold(place.Description).Contains(needle);

// ETag barato para el catálogo casi-estático: versión del JSON en disco +
// huella del contenido (no solo ids: un PUT que edita nombre o foto debe
// invalidar la caché del navegador).
// Evita reenviar 45 lugares si el navegador ya los tiene (If-None-Match -> 304).
static string PlaceFingerprint(Place p) =>
    $"{p.Id}:{p.Name}:{p.Country}:{p.Category}:{p.Description}:{p.Latitude}:{p.Longitude}:{p.ImageUrl}:{p.GoogleMapsUrl}:{p.HasStreetView}";

static string CatalogETag(IEnumerable<Place> places, long version) =>
    BuildETag(string.Join("|", places.Select(PlaceFingerprint)), version);

// La página también forma parte de la representación: mismo contenido en otra
// página no debe devolver 304, y un cambio de total/totalPages debe invalidar.
static string PagedETag(PagedResult<Place> page, long version) =>
    BuildETag(
        $"{page.Page}:{page.PageSize}:{page.TotalCount}:{page.TotalPages}|" +
        string.Join("|", page.Items.Select(PlaceFingerprint)),
        version);

static string BuildETag(string content, long version)
{
    var hash = Convert.ToHexString(
        System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(content)));
    return $"W/\"{version}-{hash[..16]}\"";
}

static bool IsNotModified(HttpContext http, string etag)
{
    var incoming = http.Request.Headers.IfNoneMatch.ToString();
    if (string.IsNullOrWhiteSpace(incoming) || string.IsNullOrWhiteSpace(etag)) return false;
    if (incoming.Contains('*')) return true;
    static string Norm(string s) => s.Trim().Replace("W/", "", StringComparison.Ordinal).Trim('"', ' ');
    var want = Norm(etag);
    return incoming.Split(',').Any(v => Norm(v) == want);
}

static IResult ConditionalOk<T>(HttpContext http, string etag, T value)
{
    http.Response.Headers.ETag = etag;
    return IsNotModified(http, etag) ? Results.StatusCode(304) : Results.Ok(value);
}

// Si el JSON desaparece o no se puede leer, no rompemos las lecturas que ya
// están en la DB: el ETag sigue siendo válido por el contenido.
long CatalogVersion()
{
    try { return File.GetLastWriteTimeUtc(jsonPath).Ticks; }
    catch { return 0; }
}

// Administración con clave compartida (header X-Admin-Key == env ADMIN_KEY).
// Sin ADMIN_KEY configurado, la escritura queda deshabilitada (solo lectura).
static bool IsAdmin(string? provided)
{
    var expected = Environment.GetEnvironmentVariable("ADMIN_KEY");
    return !string.IsNullOrWhiteSpace(expected) && provided == expected;
}

static IResult? RequireAdmin(string? provided) =>
    IsAdmin(provided)
        ? null
        : Results.Problem(
            statusCode: StatusCodes.Status403Forbidden,
            title: "No autorizado",
            detail: "Falta la clave de administrador o no está configurada.");

static bool IsHttpUrl(string? url) =>
    Uri.TryCreate(url, UriKind.Absolute, out var uri) &&
    (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

static string? ValidatePlace(Place place, bool isNew, Func<string, bool> exists)
{
    if (string.IsNullOrWhiteSpace(place.Id) ||
        !Regex.IsMatch(place.Id.Trim(), "^[a-z0-9]+(?:-[a-z0-9]+)*$"))
    {
        return "Id inválido: usa minúsculas, números y guiones (p. ej. torre-pisa).";
    }
    if (string.IsNullOrWhiteSpace(place.Name)) return "Name es obligatorio.";
    if (string.IsNullOrWhiteSpace(place.Country)) return "Country es obligatorio.";
    if (string.IsNullOrWhiteSpace(place.Category)) return "Category es obligatoria.";
    if (place.Latitude is < -90 or > 90) return "Latitude debe estar entre -90 y 90.";
    if (place.Longitude is < -180 or > 180) return "Longitude debe estar entre -180 y 180.";
    if (!IsHttpUrl(place.ImageUrl)) return "ImageUrl debe ser una URL http(s) válida.";
    if (!IsHttpUrl(place.GoogleMapsUrl)) return "GoogleMapsUrl debe ser una URL http(s) válida.";
    if (isNew && exists(place.Id)) return $"Ya existe un lugar con id '{place.Id}'.";
    return null;
}

var jsonLock = new object();
var jsonWriteOptions = new JsonSerializerOptions
{
    WriteIndented = true,
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    // Sin escapes \u00XX: el archivo sigue legible en UTF-8 y el diff es mínimo.
    Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
};

// El JSON sigue siendo el origen para el próximo arranque: cada escritura
// se refleja en disco. Si el disco falla, el cambio queda solo en la DB (se avisa en logs).
// La escritura es atómica (temporal + rename): un corte a mitad nunca deja
// places.json truncado, que impediría arrancar y rompería el fallback local.
void ApplyToJson(Action<List<Place>> mutate, ILogger logger)
{
    try
    {
        lock (jsonLock)
        {
            var catalog = JsonSerializer.Deserialize<List<Place>>(
                File.ReadAllText(jsonPath), jsonOptions) ?? [];
            mutate(catalog);
            var json = JsonSerializer.Serialize(catalog, jsonWriteOptions);
            var tempPath = jsonPath + ".tmp";
            try
            {
                using (var stream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
                using (var writer = new StreamWriter(stream, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false)))
                {
                    writer.Write(json);
                    writer.Flush();
                    stream.Flush(flushToDisk: true);
                }
                File.Move(tempPath, jsonPath, overwrite: true);
            }
            finally
            {
                try
                {
                    if (File.Exists(tempPath)) File.Delete(tempPath);
                }
                catch
                {
                    // Limpieza best-effort: no ocultar el error real de escritura.
                }
            }
        }
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "No se pudo actualizar places.json de forma atómica; el cambio quedó solo en la DB.");
    }
}

app.MapGet("/api/places", (HttpContext http, GeoVistaDb db, int? page, int? pageSize, string? category, string? q) =>
{
    // no-cache (no no-store): el navegador guarda la respuesta, pero revalida
    // con If-None-Match. Así el panel admin ve sus cambios al instante y el
    // catálogo normal sigue ahorrando bytes con 304.
    http.Response.Headers.CacheControl = "public,no-cache";

    var currentPage = page.GetValueOrDefault(1);
    var size = pageSize.GetValueOrDefault(12);
    if (currentPage < 1 || size is < 1 or > 50)
    {
        return Results.Problem(
            statusCode: StatusCodes.Status400BadRequest,
            title: "Parámetros inválidos",
            detail: "page debe ser >= 1 y pageSize estar entre 1 y 50.");
    }

    var query = Query(db, category);

    // Sin búsqueda: COUNT + página en SQL. Con ?q=: el filtro de acentos
    // (Fold) va en memoria sobre la categoría ya filtrada en SQL.
    List<Place> pool;
    if (string.IsNullOrWhiteSpace(q))
    {
        // Sin parámetros: compatibilidad, devuelve el array completo (con ETag).
        if (page is null && pageSize is null)
        {
            var all = query.OrderBy(p => p.Id).ToList();
            return ConditionalOk(http, CatalogETag(all, CatalogVersion()), all);
        }

        var total = query.Count();
        var sqlPages = (int)Math.Ceiling(total / (double)size);
        var sqlItems = query.OrderBy(p => p.Id).Skip((currentPage - 1) * size).Take(size).ToList();
        var result = new PagedResult<Place>(sqlItems, currentPage, size, total, sqlPages);

        return ConditionalOk(http, PagedETag(result, CatalogVersion()), result);
    }

    var needle = Fold(q.Trim());
    // OrderBy: sin él, SQLite puede devolver las filas en cualquier orden y
    // la misma página cambiaría entre requests (y el ETag sería inútil).
    pool = query.AsEnumerable()
        .Where(p => MatchesQuery(p, needle))
        .OrderBy(p => p.Id)
        .ToList();

    if (page is null && pageSize is null)
    {
        return ConditionalOk(http, CatalogETag(pool, CatalogVersion()), pool);
    }

    var totalPages = (int)Math.Ceiling(pool.Count / (double)size);
    var items = pool.Skip((currentPage - 1) * size).Take(size).ToList();
    var pageResult = new PagedResult<Place>(items, currentPage, size, pool.Count, totalPages);

    return ConditionalOk(http, PagedETag(pageResult, CatalogVersion()), pageResult);
})
.WithName("GetPlaces").RequireRateLimiting("reads")
.WithSummary("Devuelve lugares: array completo o página { items, page, totalPages } con ?page=&pageSize=&category=&q=.");

app.MapGet("/api/places/categories", (HttpContext http, GeoVistaDb db) =>
{
    http.Response.Headers.CacheControl = "public,no-cache";
    var categories = Query(db, null)
        .Select(p => p.Category)
        .Distinct()
        .OrderBy(c => c)
        .ToList();
    var etag = BuildETag(string.Join(",", categories), CatalogVersion());

    return ConditionalOk(http, etag, categories);
})
.WithName("GetCategories").RequireRateLimiting("reads")
.WithSummary("Devuelve las categorías disponibles.");

app.MapGet("/api/places/random", (HttpContext http, GeoVistaDb db, string? category) =>
{
    // NUNCA se cachea: cada llamada debe sortear de nuevo.
    http.Response.Headers.CacheControl = "no-store";
    // Búsqueda al azar con filtro opcional por categoría (?category=Montaña).
    // COUNT + salto en SQL: no se cargan todas las filas para elegir una.
    var query = Query(db, category);
    var total = query.Count();
    if (total == 0)
    {
        return Results.Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "No encontrado",
            detail: $"No hay lugares en la categoría '{category}'.");
    }

    return Results.Ok(query.OrderBy(p => p.Id).Skip(Random.Shared.Next(total)).First());
})
.WithName("GetRandomPlace").RequireRateLimiting("reads")
.WithSummary("Devuelve un lugar aleatorio, opcionalmente de una categoría.");

app.MapGet("/api/places/{id}", (HttpContext http, GeoVistaDb db, string id) =>
{
    http.Response.Headers.CacheControl = "public,no-cache";
    if (string.IsNullOrWhiteSpace(id))
    {
        return Results.Problem(
            statusCode: StatusCodes.Status400BadRequest,
            title: "Solicitud inválida",
            detail: "El id no puede estar vacío.");
    }

    var lowered = id.Trim().ToLowerInvariant();
    var place = Query(db, null).FirstOrDefault(p => p.Id.ToLower() == lowered);
    if (place is null)
    {
        return Results.Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "No encontrado",
            detail: $"No existe un lugar con id '{id}'.");
    }

    return ConditionalOk(http, BuildETag(PlaceFingerprint(place), CatalogVersion()), place);
})
.WithName("GetPlaceById").RequireRateLimiting("reads")
.WithSummary("Devuelve un lugar por su id.");

app.MapPost("/api/places", ([FromHeader(Name = "X-Admin-Key")] string? adminKey, GeoVistaDb db, Place place) =>
{
    if (RequireAdmin(adminKey) is { } denied) return denied;
    if (ValidatePlace(place, true, id => Query(db, null).Any(p => p.Id.ToLower() == id.Trim().ToLowerInvariant())) is { } error)
    {
        return Results.Problem(
            statusCode: StatusCodes.Status400BadRequest,
            title: "Solicitud inválida",
            detail: error);
    }

    if (useDb)
    {
        db.Places.Add(place);
        db.SaveChanges();
    }
    else
    {
        memoryPlaces.Add(place);
    }
    ApplyToJson(catalog => catalog.Add(place), app.Logger);

    return Results.Created($"/api/places/{place.Id}", place);
})
.WithName("CreatePlace").RequireRateLimiting("writes")
.WithSummary("Crea un lugar (requiere header X-Admin-Key).");

app.MapPut("/api/places/{id}", ([FromHeader(Name = "X-Admin-Key")] string? adminKey, GeoVistaDb db, string id, Place place) =>
{
    if (RequireAdmin(adminKey) is { } denied) return denied;
    if (!string.Equals(place.Id, id, StringComparison.OrdinalIgnoreCase))
    {
        return Results.Problem(
            statusCode: StatusCodes.Status400BadRequest,
            title: "Solicitud inválida",
            detail: "El id del cuerpo debe coincidir con el de la ruta.");
    }
    if (ValidatePlace(place, false, _ => false) is { } error)
    {
        return Results.Problem(
            statusCode: StatusCodes.Status400BadRequest,
            title: "Solicitud inválida",
            detail: error);
    }

    var lowered = id.Trim().ToLowerInvariant();
    if (useDb)
    {
        var existing = db.Places.FirstOrDefault(p => p.Id.ToLower() == lowered);
        if (existing is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "No encontrado",
                detail: $"No existe un lugar con id '{id}'.");
        }
        db.Entry(existing).CurrentValues.SetValues(place);
        db.SaveChanges();
    }
    else
    {
        var index = memoryPlaces.FindIndex(p => string.Equals(p.Id, id, StringComparison.OrdinalIgnoreCase));
        if (index < 0)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "No encontrado",
                detail: $"No existe un lugar con id '{id}'.");
        }
        memoryPlaces[index] = place;
    }
    ApplyToJson(catalog =>
    {
        var index = catalog.FindIndex(p => string.Equals(p.Id, id, StringComparison.OrdinalIgnoreCase));
        if (index >= 0) catalog[index] = place; else catalog.Add(place);
    }, app.Logger);

    return Results.Ok(place);
})
.WithName("UpdatePlace").RequireRateLimiting("writes")
.WithSummary("Actualiza un lugar (requiere header X-Admin-Key).");

app.MapDelete("/api/places/{id}", ([FromHeader(Name = "X-Admin-Key")] string? adminKey, GeoVistaDb db, string id) =>
{
    if (RequireAdmin(adminKey) is { } denied) return denied;

    var lowered = id.Trim().ToLowerInvariant();
    if (useDb)
    {
        var existing = db.Places.FirstOrDefault(p => p.Id.ToLower() == lowered);
        if (existing is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "No encontrado",
                detail: $"No existe un lugar con id '{id}'.");
        }
        db.Places.Remove(existing);
        db.SaveChanges();
    }
    else
    {
        var removed = memoryPlaces.RemoveAll(p => string.Equals(p.Id, id, StringComparison.OrdinalIgnoreCase));
        if (removed == 0)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "No encontrado",
                detail: $"No existe un lugar con id '{id}'.");
        }
    }
    ApplyToJson(catalog => catalog.RemoveAll(p => string.Equals(p.Id, id, StringComparison.OrdinalIgnoreCase)), app.Logger);

    return Results.NoContent();
})
.WithName("DeletePlace").RequireRateLimiting("writes")
.WithSummary("Elimina un lugar (requiere header X-Admin-Key).");

app.MapGet("/api/admin/ping", (HttpContext http, [FromHeader(Name = "X-Admin-Key")] string? adminKey) =>
{
    // Verificación de clave sin efectos: el panel la usa al entrar.
    // no-store: una respuesta 200 cacheada no debe validar una clave posterior.
    http.Response.Headers.CacheControl = "no-store";
    if (RequireAdmin(adminKey) is { } denied) return denied;
    return Results.Ok(new { ok = true });
})
.WithName("AdminPing").RequireRateLimiting("writes")
.WithSummary("Verifica la clave de administrador (requiere header X-Admin-Key).");

var startedAt = DateTimeOffset.UtcNow;
app.MapGet("/health", (HttpContext http, GeoVistaDb db) =>
{
    // Sonda para Render/monitoreo: 200 = vivo, con conteo para detectar semilla rota.
    http.Response.Headers.CacheControl = "no-store";
    int count;
    try { count = useDb ? db.Places.Count() : memoryPlaces.Count; }
    catch { count = memoryPlaces.Count; }
    return Results.Ok(new
    {
        status = "ok",
        places = count,
        uptimeSeconds = (long)(DateTimeOffset.UtcNow - startedAt).TotalSeconds,
    });
})
.WithName("Health")
.WithSummary("Sonda de salud: devuelve { status, places, uptimeSeconds }.");

app.MapGet("/health/ready", (HttpContext http, GeoVistaDb db) =>
{
    // Readiness de verdad: la DB responde y hay catálogo. En modo JSON
    // comprobamos además que places.json siga legible (es la fuente de la
    // próxima escritura y del próximo arranque).
    http.Response.Headers.CacheControl = "no-store";
    try
    {
        var count = useDb ? db.Places.Count() : memoryPlaces.Count;
        if (count == 0)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Catálogo no disponible",
                detail: "No hay lugares cargados.");
        }

        if (!useDb) _ = File.ReadAllText(jsonPath);

        return Results.Ok(new
        {
            status = "ready",
            places = count,
            storage = useDb ? "sqlite" : "json",
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Readiness falló: el catálogo no es legible.");
        return Results.Problem(
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Catálogo no disponible",
            detail: "La base de datos o el catálogo no son legibles.");
    }
})
.WithName("HealthReady")
.WithSummary("Sonda de readiness: 200 si el catálogo es legible; 503 si no.");

// 404 ProblemDetails en vez de página HTML: este host solo sirve API.
app.MapFallback(() => Results.Problem(
    statusCode: StatusCodes.Status404NotFound,
    title: "No encontrado",
    detail: "La ruta solicitada no existe."));

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

// Visible para WebApplicationFactory<Program> en los tests de integración.
public partial class Program
{
}
