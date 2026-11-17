package com.mozahid.jarvis.accessibility

import android.accessibilityservice.AccessibilityService
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class AutomationActionOutcome(
    val succeeded: Boolean,
    val message: String
)

class JarvisAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        _isConnected.value = true
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val pkg = event?.packageName?.toString()
        if (!pkg.isNullOrBlank()) {
            _activePackage.value = pkg
        }
    }

    override fun onInterrupt() {
        _isConnected.value = false
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance === this) instance = null
        _isConnected.value = false
    }

    fun readCurrentScreenSummary(): String {
        val root = rootInActiveWindow
        return UiNodeTreeParser.summarizeScreen(root)
    }

    fun tapNodeByTextOrDesc(query: String): AutomationActionOutcome {
        val root = rootInActiveWindow
            ?: return AutomationActionOutcome(false, "Cannot access active window (may be a protected screen).")
        val target = findNodeMatching(root, query)
            ?: return AutomationActionOutcome(false, "No accessible UI element matched '$query'.")

        var clickable: AccessibilityNodeInfo? = target
        while (clickable != null && !clickable.isClickable) {
            clickable = clickable.parent
        }
        val clicked = (clickable ?: target).performAction(AccessibilityNodeInfo.ACTION_CLICK)
        return if (clicked) {
            AutomationActionOutcome(true, "Tapped '$query' via Accessibility node.")
        } else {
            AutomationActionOutcome(false, "Found '$query' but click action was rejected by the app.")
        }
    }

    fun enterTextInFocusedOrMatchingField(queryHint: String, text: String): AutomationActionOutcome {
        val root = rootInActiveWindow
            ?: return AutomationActionOutcome(false, "Active window unavailable.")
        val target = findEditableNode(root, queryHint)
            ?: return AutomationActionOutcome(false, "No editable input field found.")

        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        target.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
        val ok = target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        return if (ok) {
            AutomationActionOutcome(true, "Entered text into field.")
        } else {
            AutomationActionOutcome(false, "App blocked programmatic text input on this field.")
        }
    }

    fun scrollForward(): AutomationActionOutcome {
        val root = rootInActiveWindow
            ?: return AutomationActionOutcome(false, "Active window unavailable.")
        val scrollable = findScrollableNode(root)
            ?: return AutomationActionOutcome(false, "No scrollable container detected on screen.")
        val ok = scrollable.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
        return AutomationActionOutcome(ok, if (ok) "Scrolled forward." else "Scroll action failed.")
    }

    fun navigateBack(): AutomationActionOutcome {
        val ok = performGlobalAction(GLOBAL_ACTION_BACK)
        return AutomationActionOutcome(ok, if (ok) "Navigated back." else "Back action failed.")
    }

    fun openRecents(): AutomationActionOutcome {
        val ok = performGlobalAction(GLOBAL_ACTION_RECENTS)
        return AutomationActionOutcome(ok, if (ok) "Opened app switcher." else "App switcher failed.")
    }

    private fun findNodeMatching(node: AccessibilityNodeInfo, query: String): AccessibilityNodeInfo? {
        val q = query.trim().lowercase()
        val text = node.text?.toString()?.lowercase().orEmpty()
        val desc = node.contentDescription?.toString()?.lowercase().orEmpty()
        if (text.contains(q) || desc.contains(q)) return node

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val match = findNodeMatching(child, query)
            if (match != null) return match
        }
        return null
    }

    private fun findEditableNode(node: AccessibilityNodeInfo, hint: String): AccessibilityNodeInfo? {
        if (node.isEditable) {
            if (hint.isBlank()) return node
            val combined = "${node.text.orEmpty()} ${node.hintText.orEmpty()} ${node.contentDescription.orEmpty()}".lowercase()
            if (combined.contains(hint.lowercase())) return node
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findEditableNode(child, hint)
            if (found != null) return found
        }
        return if (hint.isNotBlank()) findEditableNode(node, "") else null
    }

    private fun findScrollableNode(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        if (node.isScrollable) return node
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findScrollableNode(child)
            if (found != null) return found
        }
        return null
    }

    companion object {
        @Volatile
        var instance: JarvisAccessibilityService? = null
            private set

        private val _isConnected = MutableStateFlow(false)
        val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

        private val _activePackage = MutableStateFlow("")
        val activePackage: StateFlow<String> = _activePackage.asStateFlow()
    }
}
