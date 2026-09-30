# GeoVista.Api en Render (runtime Docker: Render no tiene runtime nativo .NET).
# Build:  docker build -t geovista-api .
# Run:    docker run -p 8080:8080 -e PORT=8080 geovista-api
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/GeoVista.Api/GeoVista.Api.csproj backend/GeoVista.Api/
RUN dotnet restore backend/GeoVista.Api/GeoVista.Api.csproj
COPY . .
RUN dotnet publish backend/GeoVista.Api/GeoVista.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "GeoVista.Api.dll"]
