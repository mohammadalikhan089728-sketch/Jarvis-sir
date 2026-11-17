package com.mozahid.jarvis.settings

import com.mozahid.jarvis.BuildConfig
import com.mozahid.jarvis.security.SecureStorageManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class JarvisSettings(
    val ownerName: String = "Mozahid",
    val deviceModel: String = "Realme 6",
    val primaryLanguage: String = "Hinglish",
    val secondaryLanguage: String = "English",
    val activeModelId: String = BuildConfig.JARVIS_DEFAULT_MODEL,
    val proxyBaseUrl: String = BuildConfig.JARVIS_PROXY_BASE_URL,
    val databaseUrl: String = BuildConfig.JARVIS_DATABASE_URL,
    val wakeWordEnabled: Boolean = false,
    val ttsSpeechRate: Float = 1.0f,
    val confirmSensitiveActions: Boolean = true
)

class SettingsRepository(private val secureStorage: SecureStorageManager) {

    private val _settings = MutableStateFlow(load())
    val settings: StateFlow<JarvisSettings> = _settings.asStateFlow()

    private fun load(): JarvisSettings {
        val model = secureStorage.getString("active_model_id", BuildConfig.JARVIS_DEFAULT_MODEL)
            .takeIf { it.isNotBlank() } ?: BuildConfig.JARVIS_DEFAULT_MODEL
        val proxyUrl = secureStorage.getString("proxy_base_url", BuildConfig.JARVIS_PROXY_BASE_URL)
            .takeIf { it.isNotBlank() } ?: BuildConfig.JARVIS_PROXY_BASE_URL
        val dbUrl = secureStorage.getString("database_url", BuildConfig.JARVIS_DATABASE_URL)
            .takeIf { it.isNotBlank() } ?: BuildConfig.JARVIS_DATABASE_URL

        return JarvisSettings(
            ownerName = secureStorage.getString("owner_name", "Mozahid").ifBlank { "Mozahid" },
            deviceModel = secureStorage.getString("device_model", "Realme 6").ifBlank { "Realme 6" },
            primaryLanguage = secureStorage.getString("primary_lang", "Hinglish").ifBlank { "Hinglish" },
            secondaryLanguage = secureStorage.getString("secondary_lang", "English").ifBlank { "English" },
            activeModelId = model,
            proxyBaseUrl = proxyUrl,
            databaseUrl = dbUrl,
            wakeWordEnabled = secureStorage.getBoolean("wake_word_enabled", false),
            ttsSpeechRate = secureStorage.getString("tts_rate", "1.0").toFloatOrNull() ?: 1.0f,
            confirmSensitiveActions = secureStorage.getBoolean("confirm_sensitive", true)
        )
    }

    fun update(transform: (JarvisSettings) -> JarvisSettings) {
        val updated = transform(_settings.value)
        secureStorage.putString("owner_name", updated.ownerName)
        secureStorage.putString("device_model", updated.deviceModel)
        secureStorage.putString("primary_lang", updated.primaryLanguage)
        secureStorage.putString("secondary_lang", updated.secondaryLanguage)
        secureStorage.putString("active_model_id", updated.activeModelId)
        secureStorage.putString("proxy_base_url", updated.proxyBaseUrl)
        secureStorage.putString("database_url", updated.databaseUrl)
        secureStorage.putBoolean("wake_word_enabled", updated.wakeWordEnabled)
        secureStorage.putString("tts_rate", updated.ttsSpeechRate.toString())
        secureStorage.putBoolean("confirm_sensitive", updated.confirmSensitiveActions)
        _settings.value = updated
    }
}
