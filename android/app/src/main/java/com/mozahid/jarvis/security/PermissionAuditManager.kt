package com.mozahid.jarvis.security

import android.Manifest
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import androidx.core.content.ContextCompat
import com.mozahid.jarvis.accessibility.JarvisAccessibilityService

data class PermissionStatus(
    val id: String,
    val title: String,
    val rationale: String,
    val isGranted: Boolean,
    val isSystemSettingsRequired: Boolean = false
)

class PermissionAuditManager(private val context: Context) {

    fun auditAll(): List<PermissionStatus> {
        val notificationsGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            hasRuntimePermission(Manifest.permission.POST_NOTIFICATIONS)
        } else true

        return listOf(
            PermissionStatus(
                id = "microphone",
                title = "Microphone",
                rationale = "Required for Hinglish & English voice recognition and interruptible speech.",
                isGranted = hasRuntimePermission(Manifest.permission.RECORD_AUDIO)
            ),
            PermissionStatus(
                id = "contacts",
                title = "Contacts",
                rationale = "Required to search Mozahid's contacts and resolve matching names before calling.",
                isGranted = hasRuntimePermission(Manifest.permission.READ_CONTACTS)
            ),
            PermissionStatus(
                id = "phone",
                title = "Phone Calls",
                rationale = "Required only if placing confirmed calls directly; otherwise dialer opens safely.",
                isGranted = hasRuntimePermission(Manifest.permission.CALL_PHONE)
            ),
            PermissionStatus(
                id = "notifications",
                title = "Notifications",
                rationale = "Required for foreground microphone service, MediaProjection, and background task updates.",
                isGranted = notificationsGranted
            ),
            PermissionStatus(
                id = "camera",
                title = "Camera",
                rationale = "Optional, requested contextually when capturing visual context from camera.",
                isGranted = hasRuntimePermission(Manifest.permission.CAMERA)
            ),
            PermissionStatus(
                id = "accessibility",
                title = "Accessibility Service",
                rationale = "Optional. Must be enabled explicitly in Android Settings for UI automation, CapCut, and app navigation.",
                isGranted = isAccessibilityServiceEnabled(),
                isSystemSettingsRequired = true
            )
        )
    }

    fun hasRuntimePermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    fun isAccessibilityServiceEnabled(): Boolean {
        val am = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
            ?: return false
        val enabled = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
        return enabled.any {
            it.resolveInfo.serviceInfo.packageName == context.packageName &&
                it.resolveInfo.serviceInfo.name == JarvisAccessibilityService::class.java.name
        }
    }

    fun openAccessibilitySettingsIntent(): Intent =
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
