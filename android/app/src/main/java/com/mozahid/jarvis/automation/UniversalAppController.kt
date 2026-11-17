package com.mozahid.jarvis.automation

import com.mozahid.jarvis.accessibility.AutomationActionOutcome
import com.mozahid.jarvis.accessibility.JarvisAccessibilityService
import com.mozahid.jarvis.ai.JarvisTool
import com.mozahid.jarvis.ai.ToolExecutionResult

class UniversalAppController(
    private val intentLauncher: IntentLauncher,
    private val youTubeMusicController: YouTubeMusicController
) {
    fun buildAutomationTools(): List<JarvisTool> = listOf(
        object : JarvisTool {
            override val name = "open_app"
            override val description = "Open an installed app by name or package name."
            override suspend fun execute(args: Map<String, String>): ToolExecutionResult {
                val target = args["appName"].orEmpty()
                val ok = if (target.contains(".")) {
                    intentLauncher.launchAppByPackage(target)
                } else {
                    intentLauncher.launchAppByName(target)
                }
                return ToolExecutionResult(
                    name,
                    ok,
                    if (ok) "Opened $target." else "App '$target' is not installed."
                )
            }
        },
        object : JarvisTool {
            override val name = "search_youtube"
            override val description = "Search YouTube for songs, tutorials, or educational videos."
            override suspend fun execute(args: Map<String, String>): ToolExecutionResult {
                val res = youTubeMusicController.searchYouTube(args["query"].orEmpty())
                return ToolExecutionResult(name, res.succeeded, res.message)
            }
        },
        object : JarvisTool {
            override val name = "accessibility_action"
            override val description = "Perform tap, scroll, back, text entry, or screen read via Accessibility."
            override suspend fun execute(args: Map<String, String>): ToolExecutionResult {
                val service = JarvisAccessibilityService.instance
                    ?: return ToolExecutionResult(
                        name,
                        false,
                        "Accessibility Service is disabled. Please enable it in Settings."
                    )
                val outcome: AutomationActionOutcome = when (args["action"]) {
                    "read" -> AutomationActionOutcome(true, service.readCurrentScreenSummary())
                    "tap" -> service.tapNodeByTextOrDesc(args["target"].orEmpty())
                    "scroll" -> service.scrollForward()
                    "back" -> service.navigateBack()
                    "type" -> service.enterTextInFocusedOrMatchingField(
                        args["hint"].orEmpty(),
                        args["text"].orEmpty()
                    )
                    else -> AutomationActionOutcome(false, "Unsupported UI action '${args["action"]}'.")
                }
                return ToolExecutionResult(name, outcome.succeeded, outcome.message)
            }
        }
    )
}
