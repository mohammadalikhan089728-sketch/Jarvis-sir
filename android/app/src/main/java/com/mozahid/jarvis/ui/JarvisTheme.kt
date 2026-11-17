package com.mozahid.jarvis.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object JarvisColors {
    val DeepBlack = Color(0xFF04070D)
    val DarkNavy = Color(0xFF0A1120)
    val CardNavy = Color(0xFF0F192E)
    val ElectricBlue = Color(0xFF2563EB)
    val CyanGlow = Color(0xFF22D3EE)
    val BorderBlue = Color(0xFF1E3A5F)
    val TextPrimary = Color(0xFFF1F5F9)
    val TextSecondary = Color(0xFF94A3B8)
    val SuccessGreen = Color(0xFF22C55E)
    val WarningAmber = Color(0xFFF59E0B)
    val ErrorRed = Color(0xFFEF4444)
}

private val JarvisDarkScheme = darkColorScheme(
    primary = JarvisColors.ElectricBlue,
    secondary = JarvisColors.CyanGlow,
    background = JarvisColors.DeepBlack,
    surface = JarvisColors.DarkNavy,
    surfaceVariant = JarvisColors.CardNavy,
    onPrimary = Color.White,
    onSecondary = JarvisColors.DeepBlack,
    onBackground = JarvisColors.TextPrimary,
    onSurface = JarvisColors.TextPrimary,
    onSurfaceVariant = JarvisColors.TextSecondary,
    error = JarvisColors.ErrorRed
)

@Composable
fun JarvisTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = JarvisDarkScheme,
        content = content
    )
}
