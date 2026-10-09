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
    public async Task WhenGetPlacesPagedWithInvalidParams_ThenReturnsBadRequest(string query)
    {
        using var response = await _client.GetAsync($"/api/places{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task WhenGetRandomWithCategory_ThenReturnsPlaceOfThatCategory()
    {
        var root = await GetJsonAsync(_client, "/api/places/random?category=Montaña");

        Assert.Equal("Montaña", root.GetProperty("category").GetString());
    }

    [Fact]
    public async Task WhenGetRandomWithUnknownCategory_ThenReturnsNotFound()
    {
        using var response = await _client.GetAsync("/api/places/random?category=NoExiste");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task WhenGetCategories_ThenReturns4Categories()
    {
        var root = await GetJsonAsync(_client, "/api/places/categories");

        var categories = root.EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.Equal(["Montaña", "Monumento", "Paisaje", "Plaza"], categories);
    }

    [Fact]
    public async Task WhenGetPlaces_ThenSendsPublicCacheHeader()
    {
        using var response = await _client.GetAsync("/api/places");

        var cache = response.Headers.CacheControl;
        Assert.True(cache?.Public);
        Assert.Equal(TimeSpan.FromHours(1), cache?.MaxAge);
    }

    [Fact]
    public async Task WhenGetRandom_ThenSendsNoStoreHeader()
    {
        using var response = await _client.GetAsync("/api/places/random");

        Assert.Equal("no-store", string.Join(",", response.Headers.GetValues("Cache-Control")));
    }

    [Fact]
    public async Task WhenGetPlaceByUnknownId_ThenReturnsNotFound()
    {
        using var response = await _client.GetAsync("/api/places/no-existe");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
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
    public async Task WhenPostWithoutKey_ThenReturnsForbidden()
    {
        using var response = await _client.SendAsync(
            AdminRequest(HttpMethod.Post, "/api/places", null, new { }));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
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
    public async Task WhenAdminCrudRoundtrip_ThenPersistsAndDeletes()
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

            var fetched = await GetJsonAsync(_client, $"/api/places/{id}");
            Assert.Equal("Lugar de Prueba", fetched.GetProperty("name").GetString());

            var updated = place with { name = "Lugar de Prueba Editado" };
            using var put = await _client.SendAsync(AdminRequest(HttpMethod.Put, $"/api/places/{id}", "test-admin-key", updated));
            Assert.Equal(HttpStatusCode.OK, put.StatusCode);

            using var deleted = await _client.SendAsync(AdminRequest(HttpMethod.Delete, $"/api/places/{id}", "test-admin-key"));
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

            using var gone = await _client.GetAsync($"/api/places/{id}");
            Assert.Equal(HttpStatusCode.NotFound, gone.StatusCode);
        }
        finally
        {
            UseAdminKey(null);
        }
    }
}
