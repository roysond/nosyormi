using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nosyormi.Domain.Entities;
using Nosyormi.Infrastructure.Chat;

namespace Nosyormi.Api.Controllers;

[ApiController]
[Route("api/narration")]
public class NarrationController : ControllerBase
{
    private readonly DbContext _db;
    private readonly NarrationService _narration;

    public NarrationController(DbContext db, NarrationService narration)
    {
        _db = db;
        _narration = narration;
    }

    [HttpGet("{statementId:guid}")]
    public async Task<IActionResult> GetNarration(
        Guid statementId,
        CancellationToken cancellationToken)
    {
        var statement = await _db.Set<Statement>()
            .FirstOrDefaultAsync(s => s.Id == statementId, cancellationToken);
        if (statement is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(statement.Narration))
            return Ok(new { narration = statement.Narration });

        var transactions = await _db.Set<Transaction>()
            .Include(t => t.Category)
            .Where(t => t.StatementId == statementId)
            .ToListAsync(cancellationToken);

        var narration = await _narration.GenerateNarrationAsync(
            transactions, cancellationToken);

        statement.Narration = narration;
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(new { narration });
    }
}
