FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution and project files first (for layer caching)
COPY Nosyormi.slnx .
COPY Nosyormi.Domain/Nosyormi.Domain.csproj Nosyormi.Domain/
COPY Nosyormi.Application/Nosyormi.Application.csproj Nosyormi.Application/
COPY Nosyormi.Infrastructure/Nosyormi.Infrastructure.csproj Nosyormi.Infrastructure/
COPY Nosyormi.Api/Nosyormi.Api.csproj Nosyormi.Api/
COPY Nosyormi.Tests/Nosyormi.Tests.csproj Nosyormi.Tests/

# Restore dependencies
RUN dotnet restore Nosyormi.Api/Nosyormi.Api.csproj

# Copy all source code
COPY . .

# Publish the API project in Release mode
RUN dotnet publish Nosyormi.Api/Nosyormi.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Copy published output from build stage
COPY --from=build /app/publish .

# Expose port 8080 (ASP.NET Core default in containers)
EXPOSE 8080

# Set environment to Production
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080

# Entry point
ENTRYPOINT ["dotnet", "Nosyormi.Api.dll"]
