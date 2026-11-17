package com.mozahid.jarvis.security

enum class SensitiveActionType {
    PLACE_CALL,
    SEND_MESSAGE,
    PUBLISH_SOCIAL_POST,
    INSTALL_APPLICATION,
    DELETE_MEMORY_OR_FILE,
    OVERWRITE_PROJECT_FILE,
    CHANGE_SYSTEM_SETTING,
    SHARE_PRIVATE_DATA
}

data class PendingConfirmation(
    val id: String,
    val actionType: SensitiveActionType,
    val title: String,
    val description: String,
    val payloadJson: String,
    val createdAt: Long = System.currentTimeMillis()
)

class ConfirmationGate {
    fun requiresConfirmation(actionType: SensitiveActionType): Boolean = true
}
