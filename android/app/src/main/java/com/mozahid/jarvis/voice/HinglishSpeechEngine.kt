package com.mozahid.jarvis.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale
import java.util.UUID

sealed class VoiceState {
    data object Idle : VoiceState()
    data object Listening : VoiceState()
    data object Speaking : VoiceState()
    data class Error(val message: String) : VoiceState()
}

class HinglishSpeechEngine(private val context: Context) {

    private var speechRecognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var isTtsReady = false

    private val _voiceState = MutableStateFlow<VoiceState>(VoiceState.Idle)
    val voiceState: StateFlow<VoiceState> = _voiceState.asStateFlow()

    private val _rmsLevel = MutableStateFlow(0f)
    val rmsLevel: StateFlow<Float> = _rmsLevel.asStateFlow()

    fun initializeTts(speechRate: Float = 1.0f) {
        if (tts != null) return
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                isTtsReady = true
                tts?.language = Locale("en", "IN")
                tts?.setSpeechRate(speechRate)
                tts?.setPitch(0.96f)
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        _voiceState.value = VoiceState.Speaking
                    }

                    override fun onDone(utteranceId: String?) {
                        _voiceState.value = VoiceState.Idle
                    }

                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        _voiceState.value = VoiceState.Idle
                    }
                })
            }
        }
    }

    fun startListening(
        languageTag: String = "en-IN",
        onResult: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        stopSpeaking() // Interruptible speech
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            val msg = "Speech recognition service unavailable on this device."
            _voiceState.value = VoiceState.Error(msg)
            onError(msg)
            return
        }

        speechRecognizer?.destroy()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    _voiceState.value = VoiceState.Listening
                }

                override fun onBeginningOfSpeech() {}

                override fun onRmsChanged(rmsdB: Float) {
                    _rmsLevel.value = ((rmsdB + 2f) / 12f).coerceIn(0f, 1f)
                }

                override fun onBufferReceived(buffer: ByteArray?) {}

                override fun onEndOfSpeech() {
                    _rmsLevel.value = 0f
                }

                override fun onError(error: Int) {
                    _rmsLevel.value = 0f
                    val msg = mapSpeechError(error)
                    _voiceState.value = VoiceState.Error(msg)
                    onError(msg)
                }

                override fun onResults(results: Bundle?) {
                    _rmsLevel.value = 0f
                    _voiceState.value = VoiceState.Idle
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val text = matches?.firstOrNull().orEmpty()
                    if (text.isNotBlank()) onResult(text)
                }

                override fun onPartialResults(partialResults: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }
        speechRecognizer?.startListening(intent)
    }

    fun speak(text: String) {
        if (!isTtsReady || text.isBlank()) return
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, UUID.randomUUID().toString())
    }

    fun stopSpeaking() {
        tts?.stop()
        if (_voiceState.value is VoiceState.Speaking) {
            _voiceState.value = VoiceState.Idle
        }
    }

    fun stopListening() {
        speechRecognizer?.stopListening()
        _rmsLevel.value = 0f
        _voiceState.value = VoiceState.Idle
    }

    fun release() {
        speechRecognizer?.destroy()
        speechRecognizer = null
        tts?.stop()
        tts?.shutdown()
        tts = null
    }

    private fun mapSpeechError(code: Int): String = when (code) {
        SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission not granted"
        SpeechRecognizer.ERROR_NETWORK -> "Network error during speech recognition"
        SpeechRecognizer.ERROR_NO_MATCH -> "Could not hear clearly. Please try again."
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech detected."
        else -> "Speech recognition error ($code)"
    }
}
