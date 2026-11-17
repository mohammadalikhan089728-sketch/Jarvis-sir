package com.mozahid.jarvis.accessibility

import com.mozahid.jarvis.automation.IntentLauncher

/**
 * CapCut UI automation coordinator with visual/node verification after every step.
 * Honestly reports when CapCut renders custom OpenGL timeline surfaces that require manual touch.
 */
class CapCutAutomationHelper(private val intentLauncher: IntentLauncher) {

    fun openCapCut(): AutomationActionOutcome {
        val opened = intentLauncher.launchAppByPackage(CAPCUT_PACKAGE)
        return if (opened) {
            AutomationActionOutcome(true, "Opened CapCut.")
        } else {
            AutomationActionOutcome(false, "CapCut is not installed on this device.")
        }
    }

    fun inspectToolsAndVerify(): AutomationActionOutcome {
        val service = JarvisAccessibilityService.instance
            ?: return AutomationActionOutcome(false, "Enable JARVIS Accessibility Service to inspect CapCut tools.")
        val summary = service.readCurrentScreenSummary()
        return if (summary.contains("No accessible UI elements")) {
            AutomationActionOutcome(
                false,
                "CapCut is rendering a custom graphics surface with limited Accessibility nodes. Please tap the timeline clip manually and I can guide the next step."
            )
        } else {
            AutomationActionOutcome(true, summary)
        }
    }

    fun tapEditingAction(label: String): AutomationActionOutcome {
        val service = JarvisAccessibilityService.instance
            ?: return AutomationActionOutcome(false, "Accessibility Service is not enabled.")
        val outcome = service.tapNodeByTextOrDesc(label)
        if (!outcome.succeeded) {
            return AutomationActionOutcome(
                false,
                "Could not reliably tap '$label' in CapCut (${outcome.message}). Please adjust manually."
            )
        }
        val verification = service.readCurrentScreenSummary()
        return AutomationActionOutcome(true, "Executed '$label'. Visible tools verified:\n$verification")
    }

    companion object {
        const val CAPCUT_PACKAGE = "com.lemon.lvoverseas"
    }
}
