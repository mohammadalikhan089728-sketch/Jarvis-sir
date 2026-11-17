package com.mozahid.jarvis.ai

import com.mozahid.jarvis.memory.ConversationTurn
import com.mozahid.jarvis.memory.LongTermMemoryRepository
import com.mozahid.jarvis.security.PendingConfirmation
import com.mozahid.jarvis.security.SensitiveActionType
import java.util.UUID

sealed class AgentUiState {
    data object Idle : AgentUiState()
    data class Thinking(val stepLabel: String) : AgentUiState()
    data class AwaitingConfirmation(val pending: PendingConfirmation, val reply: String) : AgentUiState()
    data class Completed(val reply: String, val modelUsed: String, val tools: List<String>) : AgentUiState()
    data class Failed(val errorMessage: String) : AgentUiState()
}

class JarvisAgentOrchestrator(
    private val proxyClient: GeminiProxyClient,
    private val memoryRepository: LongTermMemoryRepository,
    val toolRegistry: ToolRegistry
) {
    suspend fun processInstruction(
        userText: String,
        history: List<ConversationTurn>,
        memorySnippets: List<String>,
        screenSummary: String? = null
    ): AgentUiState {
        val formattedHistory = history.map { it.role to it.content }
        return when (val res = proxyClient.sendAgentPrompt(userText, formattedHistory, memorySnippets, screenSummary)) {
            is ApiResult.Success -> {
                val data = res.data
                memoryRepository.saveConversationTurn(
                    ConversationTurn(role = "user", content = userText, channel = "text")
                )
                memoryRepository.saveConversationTurn(
                    ConversationTurn(
                        role = "assistant",
                        content = data.reply,
                        channel = "text",
                        modelUsed = data.modelUsed
                    )
                )

                if (!data.pendingConfirmationTitle.isNullOrBlank()) {
                    AgentUiState.AwaitingConfirmation(
                        pending = PendingConfirmation(
                            id = "conf_${UUID.randomUUID().toString().take(8)}",
                            actionType = SensitiveActionType.PLACE_CALL,
                            title = data.pendingConfirmationTitle,
                            description = data.pendingConfirmationAction ?: data.reply,
                            payloadJson = "{}"
                        ),
                        reply = data.reply
                    )
                } else {
                    AgentUiState.Completed(
                        reply = data.reply,
                        modelUsed = data.modelUsed,
                        tools = data.executedTools
                    )
                }
            }
            is ApiResult.NetworkError -> AgentUiState.Failed(res.message)
            is ApiResult.PermissionDenied -> AgentUiState.Failed("Auth/Permission error: ${res.message}")
            is ApiResult.Failure -> AgentUiState.Failed(res.message)
            ApiResult.Loading -> AgentUiState.Thinking("Processing...")
        }
    }
}
