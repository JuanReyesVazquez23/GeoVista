using GeoVista.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GeoVista.Api.Data;

// SQLite en archivo local (App_Data/geovista.db), sembrada desde places.json.
// Si el hosting no permite escritura, Program.cs detecta el fallo
// y sigue sirviendo places.json en memoria sin caerse.
public sealed class GeoVistaDb(DbContextOptions<GeoVistaDb> options) : DbContext(options)
{
    public DbSet<Place> Places => Set<Place>();
}
