using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace Nosyormi.Tests.Integration;

public class StatementsControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string FallbackConnectionString =
        "Host=localhost;Port=5432;Database=nosyormi;Username=your_db_user;Password=your_db_password";

    private readonly HttpClient _client;

    static StatementsControllerTests()
    {
        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING")))
            Environment.SetEnvironmentVariable("DATABASE_CONNECTION_STRING", FallbackConnectionString);
    }

    public StatementsControllerTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ASPNETCORE_ENVIRONMENT", "Development");
        }).CreateClient();
    }

    [Fact]
    public async Task GetAll_ReturnsOk()
    {
        // Act
        var response = await _client.GetAsync("/api/statements");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetAll_ReturnsJsonArray()
    {
        // Act
        var response = await _client.GetAsync("/api/statements");
        var content = await response.Content.ReadAsStringAsync();

        // Assert: response is a JSON array
        Assert.StartsWith("[", content.Trim());
    }

    [Fact]
    public async Task GetById_WithInvalidGuid_ReturnsNotFound()
    {
        // Arrange: use a valid GUID format that doesn't exist in the database
        var nonExistentId = Guid.NewGuid();

        // Act
        var response = await _client.GetAsync($"/api/statements/{nonExistentId}");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Delete_WithInvalidGuid_ReturnsNotFound()
    {
        // Arrange
        var nonExistentId = Guid.NewGuid();

        // Act
        var response = await _client.DeleteAsync($"/api/statements/{nonExistentId}");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Upload_WithNoCsvFile_ReturnsBadRequest()
    {
        // Arrange: send empty multipart form with no file
        using var form = new MultipartFormDataContent();

        // Act
        var response = await _client.PostAsync("/api/statements/upload", form);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Upload_WithNonCsvFile_ReturnsBadRequest()
    {
        // Arrange: send a .txt file instead of .csv
        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes("not a csv"));
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/plain");
        form.Add(fileContent, "file", "test.txt");

        // Act
        var response = await _client.PostAsync("/api/statements/upload", form);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
