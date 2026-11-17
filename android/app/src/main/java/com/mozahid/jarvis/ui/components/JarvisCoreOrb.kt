package com.mozahid.jarvis.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.mozahid.jarvis.ui.JarvisColors
import kotlin.math.sin

@Composable
fun JarvisCoreOrb(
    isListening: Boolean,
    isSpeaking: Boolean,
    rmsLevel: Float,
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "jarvis_core")
    val pulse by transition.animateFloat(
        initialValue = 0.94f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = if (isListening || isSpeaking) 900 else 2400, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )

    Box(modifier = modifier.size(180.dp), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(180.dp)) {
            val radius = size.minDimension / 2f
            val activeScale = pulse + (rmsLevel * 0.14f)
            val coreColor = when {
                isListening -> JarvisColors.CyanGlow
                isSpeaking -> JarvisColors.ElectricBlue
                else -> JarvisColors.ElectricBlue.copy(alpha = 0.8f)
            }

            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        coreColor.copy(alpha = 0.35f),
                        JarvisColors.DarkNavy.copy(alpha = 0.1f),
                        JarvisColors.DeepBlack.copy(alpha = 0f)
                    )
                ),
                radius = radius * activeScale
            )

            drawCircle(
                color = JarvisColors.CyanGlow.copy(alpha = 0.45f),
                radius = radius * 0.68f * activeScale,
                style = Stroke(width = 3.dp.toPx())
            )

            drawCircle(
                color = coreColor,
                radius = radius * 0.42f * activeScale,
                style = Stroke(width = 5.dp.toPx())
            )
        }
    }
}

@Composable
fun AudioWaveformBar(
    rmsLevel: Float,
    isActive: Boolean,
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "wave")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 6.283f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "phase"
    )

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(36.dp)
    ) {
        val bars = 28
        val step = size.width / bars
        val centerY = size.height / 2f
        for (i in 0 until bars) {
            val amplitude = if (isActive) {
                val wave = (sin(phase + i * 0.45f) + 1f) * 0.5f
                (0.22f + wave * (0.4f + rmsLevel * 0.45f)) * (size.height * 0.45f)
            } else {
                3.dp.toPx()
            }
            val x = i * step + step / 2f
            drawLine(
                color = if (isActive) JarvisColors.CyanGlow else JarvisColors.BorderBlue,
                start = Offset(x, centerY - amplitude),
                end = Offset(x, centerY + amplitude),
                strokeWidth = 3.dp.toPx(),
                cap = StrokeCap.Round
            )
        }
    }
}
