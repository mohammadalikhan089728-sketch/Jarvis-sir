package com.mozahid.jarvis.memory

import java.util.UUID

enum class MemoryCategory(val key: String, val label: String) {
    PREFERENCE("preference", "Preference"),
    PROJECT("project", "Project"),
    INSTRUCTION("instruction", "Instruction"),
    WEBDEV("webdev", "Web Development"),
    CONVERSATION("conversation", "Conversation"),
    CONTACT_NOTE("contact_note", "Contact Note")
}

enum class ImportanceLevel(val key: String) {
    LOW("low"),
    NORMAL("normal"),
    HIGH("high"),
    CRITICAL("critical")
}

data class MemoryRecord(
    val id: String = "mem_${UUID.randomUUID().toString().replace("-", "").take(16)}",
    val category: String = MemoryCategory.INSTRUCTION.key,
    val title: String = "",
    val content: String = "",
    val tags: List<String> = emptyList(),
    val importance: String = ImportanceLevel.NORMAL.key,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

data class ConversationTurn(
    val id: String = "msg_${UUID.randomUUID().toString().replace("-", "").take(16)}",
    val sessionId: String = "default",
    val role: String = "user",
    val content: String = "",
    val channel: String = "text",
    val modelUsed: String = "",
    val createdAt: Long = System.currentTimeMillis()
)
