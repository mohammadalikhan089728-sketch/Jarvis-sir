export type VoiceEngineState = 'idle' | 'listening' | 'speaking' | 'wake_standby' | 'error';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function listEnglishVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('en'));
}

export function speakNatural(
  text: string,
  options: {
    rate?: number;
    voiceURI?: string;
    onStart?: () => void;
    onEnd?: () => void;
  } = {}
): void {
  if (!('speechSynthesis' in window) || !text.trim()) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voices = listEnglishVoices();
  const preferred =
    (options.voiceURI ? voices.find((v) => v.voiceURI === options.voiceURI) : undefined) ||
    voices.find((v) => /natural|neural|google uk|google us|en-in/i.test(v.name)) ||
    voices[0];

  if (preferred) utterance.voice = preferred;
  utterance.lang = preferred?.lang || 'en-IN';
  utterance.rate = options.rate ?? 1.02;
  utterance.pitch = 0.96;

  utterance.onstart = () => options.onStart?.();
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => options.onEnd?.();

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export class JarvisVoiceController {
  private recognition: SpeechRecognitionLike | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private rafId: number | null = null;

  startListening(params: {
    lang: 'en-IN' | 'en-US' | 'hi-IN';
    continuous?: boolean;
    onStateChange: (state: VoiceEngineState) => void;
    onInterim: (text: string) => void;
    onFinal: (text: string) => void;
    onLevel: (rms: number) => void;
    onError: (msg: string) => void;
  }): void {
    stopSpeaking();
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      params.onError('Browser speech recognition is unavailable here. Use the text input or audio clip upload.');
      params.onStateChange('error');
      return;
    }

    this.stop();

    const rec = new Ctor();
    rec.lang = params.lang;
    rec.continuous = Boolean(params.continuous);
    rec.interimResults = true;

    rec.onstart = () => {
      params.onStateChange(params.continuous ? 'wake_standby' : 'listening');
      void this.startAudioMeter(params.onLevel);
    };

    rec.onresult = (event) => {
      let transcript = '';
      let isFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        transcript = res[0]?.transcript || '';
        if (res.isFinal) isFinal = true;
      }
      if (isFinal && transcript.trim()) {
        params.onFinal(transcript.trim());
      } else if (transcript.trim()) {
        params.onInterim(transcript.trim());
      }
    };

    rec.onerror = (ev) => {
      const code = ev.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        params.onError('Microphone permission was denied. Enable microphone access in browser permissions.');
      } else if (code === 'no-speech') {
        params.onError('No speech detected. Tap the microphone button to try again.');
      } else if (code !== 'aborted') {
        params.onError(`Speech recognition error: ${code}`);
      }
      params.onStateChange('error');
      this.stopAudioMeter(params.onLevel);
    };

    rec.onend = () => {
      this.stopAudioMeter(params.onLevel);
      params.onStateChange('idle');
    };

    this.recognition = rec;
    try {
      rec.start();
    } catch (err) {
      params.onError(err instanceof Error ? err.message : 'Unable to start speech recognition.');
      params.onStateChange('error');
    }
  }

  private async startAudioMeter(onLevel: (rms: number) => void): Promise<void> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioCtx = new AudioContext();
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.min(1, Math.sqrt(sum / data.length) * 3.5);
        onLevel(rms);
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    } catch {
      // Audio meter is optional; speech recognition may still work.
    }
  }

  private stopAudioMeter(onLevel?: (rms: number) => void): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
    onLevel?.(0);
  }

  stop(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop errors if already stopped
      }
      this.recognition = null;
    }
    this.stopAudioMeter();
  }
}
