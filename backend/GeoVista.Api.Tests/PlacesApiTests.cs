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
}
