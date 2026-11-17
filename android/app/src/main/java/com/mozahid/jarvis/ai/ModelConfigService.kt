package com.mozahid.jarvis.ai

import com.mozahid.jarvis.settings.SettingsRepository

data class ModelDescriptor(
    val id: String,
    val label: String,
    val supportsMultimodal: Boolean,
    val supportsFunctionCalling: Boolean,
    val isAvailable: Boolean = true
)

class ModelConfigService(private val settingsRepository: SettingsRepository) {

    private val prohibitedModelSubstrings = listOf(
        "flash-lite",
        "gemini-1.5",
        "gemini-2.0",
        "gemini-pro"
    )

    fun activeModelId(): String {
        val configured = settingsRepository.settings.value.activeModelId.trim()
        return if (isAllowedModel(configured)) configured else DEFAULT_MODEL
    }

    fun isAllowedModel(modelId: String): Boolean {
        if (modelId.isBlank()) return false
        val lower = modelId.lowercase()
        return prohibitedModelSubstrings.none { lower.contains(it) }
    }

    fun setActiveModel(modelId: String): Result<String> {
        val cleaned = modelId.trim()
        if (!isAllowedModel(cleaned)) {
            return Result.failure(
                IllegalArgumentException("Model '$cleaned' is deprecated or Flash-Lite, which is disabled for JARVIS.")
            )
        }
        settingsRepository.update { it.copy(activeModelId = cleaned) }
        return Result.success(cleaned)
    }

    companion object {
        const val DEFAULT_MODEL = "gemini-4-hydrogen"
    }
}
