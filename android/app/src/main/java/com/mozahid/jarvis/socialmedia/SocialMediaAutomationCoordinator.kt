package com.mozahid.jarvis.socialmedia

import com.mozahid.jarvis.accessibility.AutomationActionOutcome
import com.mozahid.jarvis.accessibility.JarvisAccessibilityService
import com.mozahid.jarvis.automation.IntentLauncher

data class SocialPostDraft(
    val platform: String,
    val title: String,
    val description: String,
    val caption: String,
    val hashtags: List<String>,
    val tags: List<String>
)

class SocialMediaAutomationCoordinator(private val intentLauncher: IntentLauncher) {

    fun openPlatform(platform: String): Boolean {
        val pkg = when (platform.lowercase()) {
            "youtube" -> "com.google.android.youtube"
            "instagram" -> "com.instagram.android"
            "facebook" -> "com.facebook.katana"
            else -> return intentLauncher.launchAppByName(platform)
        }
        return intentLauncher.launchAppByPackage(pkg)
    }

    fun populateDraftFields(draft: SocialPostDraft): AutomationActionOutcome {
        val service = JarvisAccessibilityService.instance
            ?: return AutomationActionOutcome(
                false,
                "Enable Accessibility Service so JARVIS can fill title/caption fields in ${draft.platform}."
            )
        val combinedCaption = "${draft.caption}\n\n${draft.hashtags.joinToString(" ")}"
        val filled = service.enterTextInFocusedOrMatchingField("caption", combinedCaption)
        if (!filled.succeeded) {
            return service.enterTextInFocusedOrMatchingField("title", draft.title)
        }
        return AutomationActionOutcome(
            true,
            "Filled draft fields on ${draft.platform}. Waiting for Mozahid's final approval before publishing."
        )
    }
}
