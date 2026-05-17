using Microsoft.AspNetCore.Mvc;
using Nosyormi.Application.Analysis;

namespace Nosyormi.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ForecastController : ControllerBase
{
    private readonly IForecastingService _forecastingService;

    public ForecastController(IForecastingService forecastingService)
    {
        _forecastingService = forecastingService;
    }

    [HttpGet("{statementId:guid}")]
    public async Task<IActionResult> GetForecast(
        Guid statementId,
        CancellationToken cancellationToken)
    {
        var forecasts = await _forecastingService.ForecastAsync(statementId, cancellationToken);

        if (forecasts.Count == 0)
            return NotFound(new { error = $"Statement {statementId} not found." });

        return Ok(forecasts);
    }
}
