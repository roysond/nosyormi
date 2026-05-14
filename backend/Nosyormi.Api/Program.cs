// ─────────────────────────────────────────────────────────────────────
// NOSYOR.M.I — API Entry Point
// This is the Composition Root: where services are registered and the
// application pipeline is configured.
// ─────────────────────────────────────────────────────────────────────

var builder = WebApplication.CreateBuilder(args);

// ─── Service Registration ────────────────────────────────────────────
// Services registered here become available everywhere in the app via
// dependency injection. As we build out Application & Infrastructure
// layers, this is where their services get wired in.

builder.Services.AddOpenApi();

var app = builder.Build();

// ─── HTTP Request Pipeline ───────────────────────────────────────────
// The order of middleware here matters — requests flow through this
// pipeline top-to-bottom on the way in, and bottom-to-top on the way out.

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// ─── Endpoints ───────────────────────────────────────────────────────
// Health check endpoint — confirms the API is alive and responding.
// This is the only endpoint defined directly in Program.cs. All
// feature-specific endpoints will live in dedicated controllers.

app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    service = "Nosyormi.Api",
    timestamp = DateTime.UtcNow
}))
.WithName("HealthCheck");

app.Run();