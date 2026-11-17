package com.mozahid.jarvis.screenvision

import android.util.Base64
import com.mozahid.jarvis.ai.ApiResult
import com.mozahid.jarvis.ai.GeminiProxyClient

class MultimodalScreenAnalyzer(private val proxyClient: GeminiProxyClient) {

    suspend fun analyzeCapturedFrame(jpegBytes: ByteArray, question: String): ApiResult<String> {
        val base64 = Base64.encodeToString(jpegBytes, Base64.NO_WRAP)
        val prompt = question.ifBlank {
            "Analyze this single captured screen frame: describe visible content, extract key text, and explain what is shown. Do not claim to have watched an entire video."
        }
        return proxyClient.analyzeFrame(base64, "image/jpeg", prompt)
    }
}
