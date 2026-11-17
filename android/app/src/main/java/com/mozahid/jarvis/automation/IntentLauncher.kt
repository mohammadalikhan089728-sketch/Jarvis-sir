package com.mozahid.jarvis.automation

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings

class IntentLauncher(private val context: Context) {

    fun launchAppByPackage(packageName: String): Boolean {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName) ?: return false
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(launchIntent)
        return true
    }

    fun launchAppByName(appName: String): Boolean {
        val pm = context.packageManager
        val mainIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val apps = pm.queryIntentActivities(mainIntent, 0)
        val target = apps.firstOrNull {
            it.loadLabel(pm).toString().contains(appName.trim(), ignoreCase = true)
        } ?: return false
        return launchAppByPackage(target.activityInfo.packageName)
    }

    fun searchPlayStore(query: String): Boolean {
        val uri = Uri.parse("market://search?q=${Uri.encode(query)}")
        val intent = Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return runCatching {
            context.startActivity(intent)
            true
        }.getOrElse {
            val webIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://play.google.com/store/search?q=${Uri.encode(query)}")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            runCatching { context.startActivity(webIntent); true }.getOrDefault(false)
        }
    }

    fun openSystemSettings(): Boolean {
        val intent = Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return runCatching { context.startActivity(intent); true }.getOrDefault(false)
    }

    fun openGoogleMapsSearch(query: String): Boolean {
        val uri = Uri.parse("geo:0,0?q=${Uri.encode(query)}")
        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            setPackage("com.google.android.apps.maps")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return runCatching { context.startActivity(intent); true }.getOrElse {
            val web = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://www.google.com/maps/search/${Uri.encode(query)}")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            runCatching { context.startActivity(web); true }.getOrDefault(false)
        }
    }
}
