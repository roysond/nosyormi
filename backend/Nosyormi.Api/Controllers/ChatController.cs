using Microsoft.AspNetCore.Mvc;
using Nosyormi.Application.Chat;

namespace Nosyormi.Api.Controllers;

public record ChatRequest(
    string Message,
    IReadOnlyList<ChatMessage> History
);

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly IChatService _chatService;

    public ChatController(IChatService chatService)
    {
        _chatService = chatService;
    }

    [HttpPost("{statementId:guid}")]
    public async Task<IActionResult> Chat(
        Guid statementId,
        [FromBody] ChatRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { error = "Message cannot be empty." });

        var response = await _chatService.ChatAsync(
            statementId,
            request.Message,
            request.History,
            cancellationToken);

        return Ok(response);
    }
}
