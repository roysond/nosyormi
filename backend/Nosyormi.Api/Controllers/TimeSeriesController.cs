using Microsoft.AspNetCore.Mvc;
using Nosyormi.Application.Analysis;

namespace Nosyormi.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TimeSeriesController : ControllerBase
{
    private readonly ITimeSeriesService _timeSeriesService;

    public TimeSeriesController(ITimeSeriesService timeSeriesService)
    {
        _timeSeriesService = timeSeriesService;
    }

    [HttpGet("{statementId:guid}")]
    public async Task<IActionResult> GetTimeSeries(
        Guid statementId,
        CancellationToken cancellationToken)
    {
        var timeSeries = await _timeSeriesService.GetTimeSeriesAsync(statementId, cancellationToken);

        if (timeSeries.Count == 0)
        {
            return NotFound(new
            {
                error = $"No time series data found for statement {statementId}."
            });
        }

        return Ok(timeSeries);
    }
}
