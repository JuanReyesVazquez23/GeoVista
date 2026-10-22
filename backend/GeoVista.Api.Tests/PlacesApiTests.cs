using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Hosting;

namespace GeoVista.Api.Tests;

// Tests de integración contra la API en memoria (TestServer, sin red).
// Cubren contrato, paginación, sorteo por categoría y cabeceras de caché.
public class GeoVistaWebFactory : WebApplicationFactory<Program>
{
    protected override IHost CreateHost(IHostBuilder builder)
    {
        // ContentRoot = carpeta del proyecto API (donde vive Data/places.json).
        var apiDir = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "GeoVista.Api"));
        builder.UseContentRoot(apiDir);
        return base.CreateHost(builder);
    }
}

public class PlacesApiTests : IClassFixture<GeoVistaWebFactory>
{
    private readonly HttpClient _client;

    public PlacesApiTests(GeoVistaWebFactory factory)
    {
        _client = factory.CreateClient();
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static async Task<JsonElement> GetJsonAsync(HttpClient client, string url)
    {
        using var response = await client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return doc.RootElement.Clone();
    }

    private static async Task AssertProblemAsync(HttpResponseMessage response, int status)
    {
        Assert.Equal((HttpStatusCode)status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(status, doc.RootElement.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(doc.RootElement.GetProperty("title").GetString()));
    }

    private static string CatalogPath => Path.GetFullPath(Path.Combine(
        AppContext.BaseDirectory, "..", "..", "..", "..", "GeoVista.Api", "Data", "places.json"));

    private static async Task<JsonDocument> ReadCatalogAsync() =>
        JsonDocument.Parse(await File.ReadAllTextAsync(CatalogPath));

    [Fact]
    public async Task WhenGetPlaces_ThenReturns45Places()
    {
        var root = await GetJsonAsync(_client, "/api/places");

        Assert.Equal(JsonValueKind.Array, root.ValueKind);
        Assert.Equal(45, root.GetArrayLength());
    }

    [Fact]
    public async Task WhenGetPlacesPaged_ThenReturnsEnvelope()
    {
        var root = await GetJsonAsync(_client, "/api/places?page=2&pageSize=9");

        Assert.Equal(9, root.GetProperty("items").GetArrayLength());
        Assert.Equal(2, root.GetProperty("page").GetInt32());
        Assert.Equal(45, root.GetProperty("totalCount").GetInt32());
        Assert.Equal(5, root.GetProperty("totalPages").GetInt32());
    }

    [Theory]
    [InlineData("?page=0&pageSize=9")]
    [InlineData("?page=1&pageSize=51")]
    public async Task WhenGetPlacesPagedWithInvalidParams_ThenReturnsProblemDetails(string query)
    {
        using var response = await _client.GetAsync($"/api/places{query}");

        await AssertProblemAsync(response, 400);
    }

    [Fact]
    public async Task WhenGetRandomWithCategory_ThenReturnsPlaceOfThatCategory()
    {
        var root = await GetJsonAsync(_client, "/api/places/random?category=Montaña");

        Assert.Equal("Montaña", root.GetProperty("category").GetString());
    }

    [Fact]
    public async Task WhenGetRandomWithUnknownCategory_ThenReturnsProblemDetails()
    {
        using var response = await _client.GetAsync("/api/places/random?category=NoExiste");

        await AssertProblemAsync(response, 404);
    }

    [Fact]
    public async Task WhenGetCategories_ThenReturns4Categories()
    {
        var root = await GetJsonAsync(_client, "/api/places/categories");

        var categories = root.EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.Equal(["Montaña", "Monumento", "Paisaje", "Plaza"], categories);
    }

    [Fact]
    public async Task WhenGetPlaces_ThenSendsPublicNoCacheHeader()
    {
        using var response = await _client.GetAsync("/api/places");

        var cache = response.Headers.CacheControl;
        Assert.True(cache?.Public);
        Assert.True(cache?.NoCache);
        Assert.Null(cache?.MaxAge);
    }

    [Fact]
    public async Task WhenGetRandom_ThenSendsNoStoreHeader()
    {
        using var response = await _client.GetAsync("/api/places/random");

        Assert.Equal("no-store", string.Join(",", response.Headers.GetValues("Cache-Control")));
    }

    [Fact]
    public async Task WhenGetPlaceByUnknownId_ThenReturnsProblemDetails()
    {
        using var response = await _client.GetAsync("/api/places/no-existe");

        await AssertProblemAsync(response, 404);
    }

    [Fact]
    public async Task WhenSearchWithoutAccents_ThenMatchesAccentedPlaces()
    {
        var root = await GetJsonAsync(_client, "/api/places?q=montana&page=1&pageSize=9");

        Assert.Equal(4, root.GetProperty("totalCount").GetInt32());
        foreach (var item in root.GetProperty("items").EnumerateArray())
        {
            Assert.Equal("Montaña", item.GetProperty("category").GetString());
        }
    }

    [Fact]
    public async Task WhenSearchUppercase_ThenFindsPlace()
    {
        var root = await GetJsonAsync(_client, "/api/places?q=PISA&page=1&pageSize=9");

        Assert.Equal(1, root.GetProperty("totalCount").GetInt32());
        Assert.Equal(
            "torre-pisa",
            root.GetProperty("items").EnumerateArray().First().GetProperty("id").GetString());
    }

    [Fact]
    public async Task WhenGetHealth_ThenReturnsOkWithPlaceCount()
    {
        var root = await GetJsonAsync(_client, "/health");

        Assert.Equal("ok", root.GetProperty("status").GetString());
        // Sin número exacto: el catálogo crece y el test no debe romperse por añadir un destino.
        Assert.True(root.GetProperty("places").GetInt32() > 0);
        Assert.True(root.TryGetProperty("uptimeSeconds", out _));
    }

    [Fact]
    public async Task WhenGetHealthReady_ThenReturnsReadyWithCatalog()
    {
        using var response = await _client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store", string.Join(",", response.Headers.GetValues("Cache-Control")));
        var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal("ready", doc.RootElement.GetProperty("status").GetString());
        Assert.True(doc.RootElement.GetProperty("places").GetInt32() > 0);
        Assert.Contains(doc.RootElement.GetProperty("storage").GetString(), new[] { "sqlite", "json" });
    }

    [Fact]
    public async Task WhenGetApi_ThenSendsSecurityHeaders()
    {
        using var response = await _client.GetAsync("/api/places/categories");

        Assert.True(response.Headers.Contains("X-Content-Type-Options"));
        Assert.True(response.Headers.Contains("X-Frame-Options"));
        Assert.True(response.Content.Headers.Contains("Content-Security-Policy") ||
                    response.Headers.Contains("Content-Security-Policy"));
    }

    [Fact]
    public async Task WhenGetCategoriesTwiceWithETag_ThenReturnsNotModified()
    {
        using var first = await _client.GetAsync("/api/places/categories");
        first.EnsureSuccessStatusCode();
        var etag = first.Headers.ETag?.Tag ?? string.Join(",", first.Headers.GetValues("ETag"));
        Assert.False(string.IsNullOrWhiteSpace(etag));

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/places/categories");
        request.Headers.IfNoneMatch.ParseAdd(etag);
        using var second = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
    }

    [Fact]
    public async Task WhenGetPlacesTwiceWithETag_ThenReturnsNotModified()
    {
        using var first = await _client.GetAsync("/api/places");
        first.EnsureSuccessStatusCode();
        var etag = first.Headers.ETag?.Tag ?? string.Join(",", first.Headers.GetValues("ETag"));

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/places");
        request.Headers.IfNoneMatch.ParseAdd(etag);
        using var second = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
    }

    [Fact]
    public async Task WhenGetPagedPlacesTwiceWithETag_ThenReturnsNotModified()
    {
        using var first = await _client.GetAsync("/api/places?page=2&pageSize=9");
        first.EnsureSuccessStatusCode();
        var etag = first.Headers.ETag?.Tag;
        Assert.False(string.IsNullOrWhiteSpace(etag));
        Assert.True(first.Headers.CacheControl?.NoCache);

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/places?page=2&pageSize=9");
        request.Headers.IfNoneMatch.ParseAdd(etag);
        using var second = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
    }

    [Fact]
    public async Task WhenGetPlaceByIdTwiceWithETag_ThenReturnsNotModified()
    {
        using var first = await _client.GetAsync("/api/places/torre-eiffel");
        first.EnsureSuccessStatusCode();
        var etag = first.Headers.ETag?.Tag;
        Assert.False(string.IsNullOrWhiteSpace(etag));

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/places/torre-eiffel");
        request.Headers.IfNoneMatch.ParseAdd(etag);
        using var second = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
    }

    [Fact]
    public async Task WhenGetUnknownRoute_ThenReturnsProblemDetails()
    {
        using var response = await _client.GetAsync("/api/no-existe-esta-ruta");

        await AssertProblemAsync(response, 404);
    }

    [Fact]
    public async Task WhenPostOversizedBody_ThenReturnsPayloadTooLarge()
    {
        UseAdminKey("test-admin-key");
        try
        {
            var big = new
            {
                id = "lugar-enorme",
                name = "Lugar Enorme",
                country = "Testlandia",
                category = "Plaza",
                description = new string('x', 40 * 1024),
                latitude = 10.0,
                longitude = 20.0,
                imageUrl = "https://example.com/foto.jpg",
                googleMapsUrl = "https://www.google.com/maps",
                hasStreetView = true,
            };
            using var response = await _client.SendAsync(AdminRequest(
                HttpMethod.Post, "/api/places", "test-admin-key", big));

            Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        }
        finally
        {
            UseAdminKey(null);
        }
    }

    private static void UseAdminKey(string? value)
    {
        // La clave se lee por request: fijarla aquí es determinista
        // (los tests de una clase no corren en paralelo entre sí).
        Environment.SetEnvironmentVariable("ADMIN_KEY", value);
    }

    private static HttpRequestMessage AdminRequest(HttpMethod method, string url, string? key, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (key is not null) request.Headers.Add("X-Admin-Key", key);
        if (body is not null)
        {
            request.Content = new StringContent(
                JsonSerializer.Serialize(body), System.Text.Encoding.UTF8, "application/json");
        }
        return request;
    }

    [Fact]
    public async Task WhenPostWithoutKey_ThenReturnsProblemDetails()
    {
        using var response = await _client.SendAsync(
            AdminRequest(HttpMethod.Post, "/api/places", null, new { }));

        await AssertProblemAsync(response, 403);
    }

    [Fact]
    public async Task WhenAdminPingWithoutKey_ThenReturnsForbidden()
    {
        using var response = await _client.GetAsync("/api/admin/ping");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task WhenAdminPingWithKey_ThenReturnsOk()
    {
        UseAdminKey("test-admin-key");
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, "/api/admin/ping");
            request.Headers.Add("X-Admin-Key", "test-admin-key");
            using var response = await _client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("no-store", string.Join(",", response.Headers.GetValues("Cache-Control")));
        }
        finally
        {
            UseAdminKey(null);
        }
    }

    [Fact]
    public async Task WhenPostWithInvalidBody_ThenReturnsBadRequest()
    {
        UseAdminKey("test-admin-key");
        try
        {
            using var response = await _client.SendAsync(AdminRequest(
                HttpMethod.Post, "/api/places", "test-admin-key", new { id = "MAL ID", name = "" }));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        finally
        {
            UseAdminKey(null);
        }
    }

    [Fact]
    public async Task WhenAdminCrudRoundtrip_ThenPersistsAtomicallyInvalidatesETagAndDeletes()
    {
        const string id = "test-admin-lugar";
        UseAdminKey("test-admin-key");
        try
        {
            var place = new
            {
                id,
                name = "Lugar de Prueba",
                country = "Testlandia",
                category = "Plaza",
                description = "Creado por el test de admin.",
                latitude = 10.0,
                longitude = 20.0,
                imageUrl = "https://example.com/foto.jpg",
                googleMapsUrl = "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=10,20",
                hasStreetView = true,
            };

            using var created = await _client.SendAsync(AdminRequest(HttpMethod.Post, "/api/places", "test-admin-key", place));
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);

            // La escritura atómica deja el JSON válido y sin temporales.
            using (var catalog = await ReadCatalogAsync())
            {
                var saved = catalog.RootElement.EnumerateArray()
                    .Single(p => p.GetProperty("id").GetString() == id);
                Assert.Equal("Lugar de Prueba", saved.GetProperty("name").GetString());
            }
            Assert.False(File.Exists(CatalogPath + ".tmp"));

            using var beforeUpdate = await _client.GetAsync($"/api/places/{id}");
            beforeUpdate.EnsureSuccessStatusCode();
            var oldEtag = beforeUpdate.Headers.ETag?.Tag;
            Assert.False(string.IsNullOrWhiteSpace(oldEtag));

            using var pageBeforeUpdate = await _client.GetAsync("/api/places?page=1&pageSize=50");
            pageBeforeUpdate.EnsureSuccessStatusCode();
            var oldPageEtag = pageBeforeUpdate.Headers.ETag?.Tag;
            Assert.False(string.IsNullOrWhiteSpace(oldPageEtag));

            var updated = place with { name = "Lugar de Prueba Editado" };
            using var put = await _client.SendAsync(AdminRequest(HttpMethod.Put, $"/api/places/{id}", "test-admin-key", updated));
            Assert.Equal(HttpStatusCode.OK, put.StatusCode);

            // El ETag viejo ya no vale: el admin no puede recibir la copia
            // cacheada de antes de la edición (el bug original).
            var staleRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/places/{id}");
            staleRequest.Headers.IfNoneMatch.ParseAdd(oldEtag!);
            using var stale = await _client.SendAsync(staleRequest);
            Assert.Equal(HttpStatusCode.OK, stale.StatusCode);
            using var staleDoc = await JsonDocument.ParseAsync(await stale.Content.ReadAsStreamAsync());
            Assert.Equal("Lugar de Prueba Editado", staleDoc.RootElement.GetProperty("name").GetString());

            var stalePageRequest = new HttpRequestMessage(HttpMethod.Get, "/api/places?page=1&pageSize=50");
            stalePageRequest.Headers.IfNoneMatch.ParseAdd(oldPageEtag!);
            using var stalePage = await _client.SendAsync(stalePageRequest);
            Assert.Equal(HttpStatusCode.OK, stalePage.StatusCode);

            using (var catalog = await ReadCatalogAsync())
            {
                var saved = catalog.RootElement.EnumerateArray()
                    .Single(p => p.GetProperty("id").GetString() == id);
                Assert.Equal("Lugar de Prueba Editado", saved.GetProperty("name").GetString());
            }
            Assert.False(File.Exists(CatalogPath + ".tmp"));

            using var deleted = await _client.SendAsync(AdminRequest(HttpMethod.Delete, $"/api/places/{id}", "test-admin-key"));
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

            using (var catalog = await ReadCatalogAsync())
            {
                Assert.DoesNotContain(
                    catalog.RootElement.EnumerateArray(),
                    p => p.GetProperty("id").GetString() == id);
            }

            using var gone = await _client.GetAsync($"/api/places/{id}");
            Assert.Equal(HttpStatusCode.NotFound, gone.StatusCode);
        }
        finally
        {
            // Si el test falla a mitad, no dejar el lugar de prueba en places.json.
            try
            {
                using var cleanup = await _client.SendAsync(
                    AdminRequest(HttpMethod.Delete, $"/api/places/{id}", "test-admin-key"));
            }
            catch
            {
                // Limpieza best-effort.
            }
            UseAdminKey(null);
        }
    }
}
