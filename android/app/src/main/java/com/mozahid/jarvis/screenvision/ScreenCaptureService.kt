package com.mozahid.jarvis.screenvision

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import java.io.ByteArrayOutputStream

class ScreenCaptureService : Service() {

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureNotificationChannel()
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
            ?: Activity.RESULT_CANCELED
        val data: Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent?.getParcelableExtra(EXTRA_DATA_INTENT, Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent?.getParcelableExtra(EXTRA_DATA_INTENT)
        }

        if (resultCode == Activity.RESULT_OK && data != null) {
            val mgr = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = mgr.getMediaProjection(resultCode, data)
            captureSingleFrame()
        } else {
            lastCaptureCallback?.invoke(Result.failure(IllegalStateException("Screen capture permission not granted.")))
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun captureSingleFrame() {
        val metrics = resources.displayMetrics
        val width = (metrics.widthPixels / 2).coerceAtLeast(360)
        val height = (metrics.heightPixels / 2).coerceAtLeast(640)
        val density = metrics.densityDpi

        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "JarvisSingleFrame",
            width,
            height,
            density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader?.surface,
            null,
            Handler(Looper.getMainLooper())
        )

        Handler(Looper.getMainLooper()).postDelayed({
            try {
                val image = imageReader?.acquireLatestImage()
                if (image == null) {
                    lastCaptureCallback?.invoke(
                        Result.failure(IllegalStateException("No frame available (app may block screen capture via FLAG_SECURE)."))
                    )
                } else {
                    val plane = image.planes[0]
                    val buffer = plane.buffer
                    val pixelStride = plane.pixelStride
                    val rowStride = plane.rowStride
                    val rowPadding = rowStride - pixelStride * width
                    val bmp = Bitmap.createBitmap(
                        width + rowPadding / pixelStride,
                        height,
                        Bitmap.Config.ARGB_8888
                    )
                    bmp.copyPixelsFromBuffer(buffer)
                    image.close()

                    val cropped = Bitmap.createBitmap(bmp, 0, 0, width, height)
                    val out = ByteArrayOutputStream()
                    cropped.compress(Bitmap.CompressFormat.JPEG, 80, out)
                    bmp.recycle()
                    cropped.recycle()
                    lastCaptureCallback?.invoke(Result.success(out.toByteArray()))
                }
            } catch (e: Exception) {
                lastCaptureCallback?.invoke(Result.failure(e))
            } finally {
                cleanupProjection()
                stopSelf()
            }
        }, 350L)
    }

    private fun cleanupProjection() {
        virtualDisplay?.release()
        virtualDisplay = null
        imageReader?.close()
        imageReader = null
        mediaProjection?.stop()
        mediaProjection = null
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun ensureNotificationChannel() {
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "JARVIS Screen Analysis",
            NotificationManager.IMPORTANCE_LOW
        )
        mgr.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("JARVIS Screen Vision")
            .setContentText("Capturing a single visible frame for analysis")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .build()

    companion object {
        const val CHANNEL_ID = "jarvis_screen_capture"
        const val NOTIFICATION_ID = 4301
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_DATA_INTENT = "data_intent"
        var lastCaptureCallback: ((Result<ByteArray>) -> Unit)? = null
    }
}
