using Microsoft.AspNetCore.Mvc;
using Nosyormi.Application.Statements;

namespace Nosyormi.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StatementsController : ControllerBase
{
    private readonly StatementUploadService _uploadService;

    public StatementsController(StatementUploadService uploadService)
    {
        _uploadService = uploadService;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> Upload(
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { error = "No file uploaded." });
        }

        if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = "Only .csv files are supported (for now)." });
        }

        await using var stream = file.OpenReadStream();
        var result = await _uploadService.UploadAsync(file.FileName, stream, cancellationToken);

        return Ok(new
        {
            statementId = result.StatementId,
            transactionCount = result.TransactionCount,
            fileName = file.FileName
        });
    }
}