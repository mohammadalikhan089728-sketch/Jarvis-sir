package com.mozahid.jarvis.automation

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.mozahid.jarvis.accessibility.AutomationActionOutcome
import com.mozahid.jarvis.accessibility.JarvisAccessibilityService

class YouTubeMusicController(private val context: Context) {

    fun searchYouTube(query: String): AutomationActionOutcome {
        val searchUri = Uri.parse("https://www.youtube.com/results?search_query=${Uri.encode(query)}")
        val intent = Intent(Intent.ACTION_VIEW, searchUri).apply {
            setPackage("com.google.android.youtube")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val launched = runCatching { context.startActivity(intent); true }.getOrElse {
            val browserIntent = Intent(Intent.ACTION_VIEW, searchUri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            runCatching { context.startActivity(browserIntent); true }.getOrDefault(false)
        }
        return if (launched) {
            AutomationActionOutcome(
                true,
                "Opened YouTube search for '$query'. Note: background playback depends on your YouTube app/account."
            )
        } else {
            AutomationActionOutcome(false, "Unable to open YouTube or a browser on this device.")
        }
    }

    fun togglePlayback(): AutomationActionOutcome {
        val service = JarvisAccessibilityService.instance
            ?: return AutomationActionOutcome(false, "Enable Accessibility Service to tap pause/play in YouTube.")
        val pauseAttempt = service.tapNodeByTextOrDesc("Pause")
        if (pauseAttempt.succeeded) return pauseAttempt
        return service.tapNodeByTextOrDesc("Play")
    }
}
