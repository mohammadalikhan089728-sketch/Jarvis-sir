package com.mozahid.jarvis.ai

import com.mozahid.jarvis.firebase.FirebaseAuthManager
import com.mozahid.jarvis.settings.SettingsRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

sealed class ApiResult<out T> {
    data object Loading : ApiResult<Nothing>()
    data class Success<T>(val data: T) : ApiResult<T>()
    data class NetworkError(val message: String) : ApiResult<Nothing>()
    data class PermissionDenied(val message: String) : ApiResult<Nothing>()
    data class Failure(val code: Int, val message: String) : ApiResult<Nothing>()
}

data class AgentResponsePayload(
    val reply: String,
    val modelUsed: String,
    val executedTools: List<String>,
    val pendingConfirmationTitle: String? = null,
    val pendingConfirmationAction: String? = null
)

class GeminiProxyClient(
    private val settingsRepository: SettingsRepository,
    private val modelConfigService: ModelConfigService,
    private val authManager: FirebaseAuthManager
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .callTimeout(50, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private fun requireProxyBaseUrl(): String? {
        val url = settingsRepository.settings.value.proxyBaseUrl.trim().trimEnd('/')
        return url.takeIf { it.startsWith("https://") || it.startsWith("http://") }
    }

    suspend fun fetchAvailableModels(): ApiResult<List<ModelDescriptor>> = withContext(Dispatchers.IO) {
        val baseUrl = requireProxyBaseUrl()
            ?: return@withContext ApiResult.Failure(-1, "Backend proxy URL is not configured.")
        val request = Request.Builder()
            .url("$baseUrl/api/jarvis/models")
            .get()
            .build()

        executeWithRetry(request) { body ->
            val obj = JSONObject(body)
            val arr = obj.optJSONArray("models") ?: JSONArray()
            val list = buildList {
                for (i in 0 until arr.length()) {
                    val m = arr.getJSONObject(i)
                    add(
                        ModelDescriptor(
                            id = m.getString("id"),
                            label = m.optString("label", m.getString("id")),
                            supportsMultimodal = m.optBoolean("supportsMultimodal", true),
                            supportsFunctionCalling = m.optBoolean("supportsFunctionCalling", true),
                            isAvailable = m.optBoolean("isAvailable", true)
                        )
                    )
                }
            }
            list
        }
    }

    suspend fun sendAgentPrompt(
        prompt: String,
        history: List<Pair<String, String>>,
        memorySnippets: List<String>,
        screenSummary: String? = null
    ): ApiResult<AgentResponsePayload> = withContext(Dispatchers.IO) {
        val baseUrl = requireProxyBaseUrl()
            ?: return@withContext ApiResult.Failure(-1, "Backend proxy URL is not configured.")
        val token = authManager.getIdToken()

        val payload = JSONObject().apply {
            put("message", prompt)
            put("modelId", modelConfigService.activeModelId())
            put("deviceContext", JSONObject().apply {
                put("ownerName", settingsRepository.settings.value.ownerName)
                put("deviceModel", settingsRepository.settings.value.deviceModel)
                put("primaryLanguage", settingsRepository.settings.value.primaryLanguage)
                put("screenSummary", screenSummary ?: "")
            })
            put("memories", JSONArray(memorySnippets))
            put("history", JSONArray().apply {
                history.takeLast(12).forEach { (role, text) ->
                    put(JSONObject().apply {
                        put("role", role)
                        put("content", text)
                    })
                }
            })
        }

        val reqBuilder = Request.Builder()
            .url("$baseUrl/api/jarvis/agent")
            .post(payload.toString().toRequestBody(jsonMediaType))
        if (!token.isNullOrBlank()) {
            reqBuilder.addHeader("Authorization", "Bearer $token")
        }

        executeWithRetry(reqBuilder.build()) { body ->
            val obj = JSONObject(body)
            val toolsArr = obj.optJSONArray("executedTools") ?: JSONArray()
            val toolNames = buildList {
                for (i in 0 until toolsArr.length()) {
                    add(toolsArr.optJSONObject(i)?.optString("name") ?: toolsArr.optString(i))
                }
            }
            val pending = obj.optJSONObject("pendingConfirmation")
            AgentResponsePayload(
                reply = obj.getString("reply"),
                modelUsed = obj.optString("modelUsed", modelConfigService.activeModelId()),
                executedTools = toolNames,
                pendingConfirmationTitle = pending?.optString("title"),
                pendingConfirmationAction = pending?.optString("action")
            )
        }
    }

    suspend fun analyzeFrame(
        imageBase64: String,
        mimeType: String,
        question: String
    ): ApiResult<String> = withContext(Dispatchers.IO) {
        val baseUrl = requireProxyBaseUrl()
            ?: return@withContext ApiResult.Failure(-1, "Backend proxy URL is not configured.")
        val payload = JSONObject().apply {
            put("imageBase64", imageBase64)
            put("mimeType", mimeType)
            put("question", question)
            put("modelId", modelConfigService.activeModelId())
        }
        val request = Request.Builder()
            .url("$baseUrl/api/jarvis/vision")
            .post(payload.toString().toRequestBody(jsonMediaType))
            .build()

        executeWithRetry(request) { body ->
            JSONObject(body).getString("analysis")
        }
    }

    private suspend fun <T> executeWithRetry(
        request: Request,
        attempts: Int = 2,
        parser: (String) -> T
    ): ApiResult<T> {
        var lastException: Exception? = null
        repeat(attempts) { attempt ->
            try {
                client.newCall(request).execute().use { response ->
                    val raw = response.body?.string().orEmpty()
                    if (response.isSuccessful) {
                        return ApiResult.Success(parser(raw))
                    }
                    val message = runCatching {
                        JSONObject(raw).optString("error", "Server error ${response.code}")
                    }.getOrDefault("Server error ${response.code}")

                    return when (response.code) {
                        401, 403 -> ApiResult.PermissionDenied(message)
                        else -> ApiResult.Failure(response.code, message)
                    }
                }
            } catch (e: IOException) {
                lastException = e
                if (attempt < attempts - 1) delay(600L * (attempt + 1))
            } catch (e: Exception) {
                return ApiResult.Failure(-1, "Unexpected response format.")
            }
        }
        return ApiResult.NetworkError(
            if (lastException != null) "Network error communicating with JARVIS backend. Check connection and retry."
            else "Network unavailable."
        )
    }
}
