package com.mozahid.jarvis.tasks

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import com.mozahid.jarvis.BuildConfig
import kotlinx.coroutines.tasks.await

class JarvisBackgroundWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val taskId = inputData.getString("taskId") ?: return Result.failure()
        val title = inputData.getString("title") ?: "JARVIS Task"

        setForeground(createForegroundInfo(title))

        val uid = FirebaseAuth.getInstance().currentUser?.uid
        val db = if (BuildConfig.JARVIS_DATABASE_URL.isNotBlank()) {
            FirebaseDatabase.getInstance(BuildConfig.JARVIS_DATABASE_URL)
        } else {
            FirebaseDatabase.getInstance()
        }

        return try {
            if (uid != null) {
                db.getReference("users").child(uid).child("tasks").child(taskId)
                    .updateChildren(
                        mapOf(
                            "status" to "running",
                            "progress" to 40,
                            "updatedAt" to System.currentTimeMillis()
                        )
                    ).await()
            }
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    private fun createForegroundInfo(title: String): ForegroundInfo {
        val manager = applicationContext.getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            "JARVIS Background Tasks",
            NotificationManager.IMPORTANCE_LOW
        )
        manager?.createNotificationChannel(channel)

        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setContentTitle("JARVIS Task Running")
            .setContentText(title)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .build()

        return ForegroundInfo(NOTIFICATION_ID, notification)
    }

    companion object {
        const val CHANNEL_ID = "jarvis_tasks_channel"
        const val NOTIFICATION_ID = 4201
    }
}
