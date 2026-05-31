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
    public async Task Chat(
        Guid statementId,
        [FromBody] ChatRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            Response.StatusCode = 400;
            await Response.WriteAsync("{\"error\":\"Message cannot be empty.\"}");
            return;
        }

        Response.Headers["Content-Type"] = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        await _chatService.StreamChatAsync(
            statementId,
            request.Message,
            request.History,
            Response,
            cancellationToken);
    }
}
