package com.mozahid.jarvis.accessibility

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo

data class ParsedUiNode(
    val text: String,
    val contentDescription: String,
    val viewId: String,
    val className: String,
    val isClickable: Boolean,
    val isEditable: Boolean,
    val isScrollable: Boolean,
    val bounds: Rect
)

object UiNodeTreeParser {

    fun collectNodes(root: AccessibilityNodeInfo?, maxNodes: Int = 180): List<ParsedUiNode> {
        if (root == null) return emptyList()
        val result = ArrayList<ParsedUiNode>(64)
        traverse(root, result, maxNodes)
        return result
    }

    private fun traverse(
        node: AccessibilityNodeInfo,
        out: MutableList<ParsedUiNode>,
        maxNodes: Int
    ) {
        if (out.size >= maxNodes) return
        val rect = Rect()
        node.getBoundsInScreen(rect)
        val text = node.text?.toString()?.trim().orEmpty()
        val desc = node.contentDescription?.toString()?.trim().orEmpty()
        val viewId = node.viewIdResourceName.orEmpty()

        if (text.isNotEmpty() || desc.isNotEmpty() || node.isClickable || node.isEditable || node.isScrollable) {
            out.add(
                ParsedUiNode(
                    text = text,
                    contentDescription = desc,
                    viewId = viewId,
                    className = node.className?.toString().orEmpty(),
                    isClickable = node.isClickable,
                    isEditable = node.isEditable,
                    isScrollable = node.isScrollable,
                    bounds = rect
                )
            )
        }

        for (i in 0 until node.childCount) {
            if (out.size >= maxNodes) break
            val child = node.getChild(i) ?: continue
            traverse(child, out, maxNodes)
        }
    }

    fun summarizeScreen(root: AccessibilityNodeInfo?): String {
        val nodes = collectNodes(root)
        if (nodes.isEmpty()) return "No accessible UI elements visible (screen may be protected or empty)."
        return nodes.take(40).joinToString("\n") { n ->
            val label = n.text.ifBlank { n.contentDescription }.ifBlank { n.viewId }
            val flags = buildList {
                if (n.isClickable) add("clickable")
                if (n.isEditable) add("editable")
                if (n.isScrollable) add("scrollable")
            }.joinToString(",")
            "[$flags] $label (${n.className.substringAfterLast('.')})"
        }
    }
}
