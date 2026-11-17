package com.mozahid.jarvis.calls

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.ContextCompat

sealed class CallOutcome {
    data class DialerOpened(val number: String) : CallOutcome()
    data class CallStarted(val number: String) : CallOutcome()
    data class ConfirmationRequired(val reason: String) : CallOutcome()
    data class Failed(val message: String) : CallOutcome()
}

class CallController(private val context: Context) {

    fun openDialer(phoneNumber: String): CallOutcome {
        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(phoneNumber)}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return runCatching {
            context.startActivity(intent)
            CallOutcome.DialerOpened(phoneNumber)
        }.getOrElse {
            CallOutcome.Failed("Could not open dialer: ${it.localizedMessage}")
        }
    }

    fun placeConfirmedCall(phoneNumber: String, ownerConfirmed: Boolean): CallOutcome {
        if (!ownerConfirmed) {
            return CallOutcome.ConfirmationRequired("Mozahid's explicit confirmation is required before dialing $phoneNumber.")
        }
        val hasCallPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasCallPermission) {
            return openDialer(phoneNumber)
        }

        val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:${Uri.encode(phoneNumber)}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return runCatching {
            context.startActivity(intent)
            CallOutcome.CallStarted(phoneNumber)
        }.getOrElse {
            CallOutcome.Failed("Failed to place call: ${it.localizedMessage}")
        }
    }
}
