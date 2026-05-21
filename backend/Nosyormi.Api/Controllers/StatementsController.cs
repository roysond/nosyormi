using Microsoft.AspNetCore.Mvc;
using Nosyormi.Application.Statements;

namespace Nosyormi.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StatementsController : ControllerBase
{
    private readonly StatementUploadService _uploadService;
    private readonly IStatementQueryService _queryService;

    public StatementsController(
        StatementUploadService uploadService,
        IStatementQueryService queryService)
    {
        _uploadService = uploadService;
        _queryService = queryService;
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
        try
        {
            var result = await _uploadService.UploadAsync(file.FileName, stream, cancellationToken);

            return Ok(new
            {
                statementId = result.StatementId,
                transactionCount = result.TransactionCount,
                fileName = file.FileName
            });
        }
        catch (InvalidOperationException ex) when (ex.Message.StartsWith("DUPLICATE_FILE_HASH:"))
        {
            return Conflict(new { error = "This file has already been uploaded. Duplicate statements are not allowed." });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var statements = await _queryService.GetAllAsync(cancellationToken);
        return Ok(statements);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var statement = await _queryService.GetByIdAsync(id, cancellationToken);

        if (statement is null)
            return NotFound(new { error = $"Statement {id} not found." });

        return Ok(statement);
    }
}