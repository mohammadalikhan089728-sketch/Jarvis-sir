package com.mozahid.jarvis.voice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Explicit user-toggled foreground service for "Hey JARVIS" voice listening.
 * Always displays a visible system notification and never records audio secretly.
 */
class WakeWordForegroundService : Service() {

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureNotificationChannel()
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun ensureNotificationChannel() {
        val manager = getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "JARVIS Voice Listener",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Visible indicator while JARVIS hands-free wake listener is active."
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("JARVIS Voice Ready")
            .setContentText("Listening for \"Hey JARVIS\" (tap app to pause)")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val CHANNEL_ID = "jarvis_wake_voice_channel"
        const val NOTIFICATION_ID = 4101
    }
}
