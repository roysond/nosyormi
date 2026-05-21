using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nosyormi.Application.Analysis;
using Nosyormi.Infrastructure.Analysis;

namespace Nosyormi.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ForecastController : ControllerBase
{
    private readonly IForecastingService _forecastingService;
    private readonly DbContext _db;

    public ForecastController(IForecastingService forecastingService, DbContext db)
    {
        _forecastingService = forecastingService;
        _db = db;
    }

    [HttpGet("{statementId:guid}")]
    public async Task<IActionResult> GetForecast(
        Guid statementId,
        CancellationToken cancellationToken)
    {
        var monthlySpend = await StatementMonthlySpendLoader.LoadAsync(
            _db,
            statementId,
            cancellationToken);

        if (monthlySpend.Count == 0)
            return NotFound(new { error = $"Statement {statementId} not found." });

        var forecasts = await _forecastingService.ForecastAsync(monthlySpend, cancellationToken);

        return Ok(forecasts);
    }
}
