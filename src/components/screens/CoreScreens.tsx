import React, { useRef, useState } from 'react';
import {
  Camera,
  Check,
  Loader2,
  Mic,
  MicOff,
  Monitor,
  RefreshCw,
  Send,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { JarvisCoreVisual } from '../JarvisCoreVisual';
import type {
  AutomationPlan,
  ConversationMessage,
  SocialSeoResult,
  TaskRecord,
} from '../../types/jarvis';
import type { VoiceEngineState } from '../../services/voiceService';

interface HomeScreenProps {
  ownerName: string;
  activeModelId: string;
  voiceState: VoiceEngineState;
  audioLevel: number;
  isThinking: boolean;
  latestReply: string;
  latestError: string | null;
  latestTools: string[];
  latestPlan: AutomationPlan | null;
  latestSeo: SocialSeoResult | null;
  activeTasksCount: number;
  runningTaskTitle: string | null;
  memorySyncStatus: 'synced' | 'syncing' | 'offline' | 'unauthenticated';
  memoriesCount: number;
  interimTranscript: string;
  onSendCommand: (text: string, speakReply?: boolean) => Promise<void>;
  onToggleMic: () => void;
  onStopSpeaking: () => void;
  onAnalyzeFrame: (base64: string, mimeType: string, question: string, factCheck: boolean) => Promise<void>;
  onRetryLast: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  ownerName,
  activeModelId,
  voiceState,
  audioLevel,
  isThinking,
  latestReply,
  latestError,
  latestTools,
  latestPlan,
  latestSeo,
  activeTasksCount,
  runningTaskTitle,
  memorySyncStatus,
  memoriesCount,
  interimTranscript,
  onSendCommand,
  onToggleMic,
  onStopSpeaking,
  onAnalyzeFrame,
  onRetryLast,
}) => {
  const [input, setInput] = useState('');
  const [visionQuestion, setVisionQuestion] = useState('');
  const [factCheck, setFactCheck] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;
    setInput('');
    await onSendCommand(trimmed, false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = String(reader.result || '');
      const base64 = result.split(',')[1] || '';
      if (base64) {
        await onAnalyzeFrame(
          base64,
          file.type || 'image/jpeg',
          visionQuestion.trim() || 'Analyze this image or video frame for Mozahid.',
          factCheck
        );
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCaptureScreenFrame = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      await onSendCommand('Screen capture is not supported in this browser tab. Upload a screenshot or video frame instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(1280, video.videoWidth || 1280);
      canvas.height = Math.round((canvas.width * (video.videoHeight || 720)) / (video.videoWidth || 1280));
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      track.stop();
      stream.getTracks().forEach((t) => t.stop());
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      const base64 = dataUrl.split(',')[1] || '';
      if (base64) {
        await onAnalyzeFrame(
          base64,
          'image/jpeg',
          visionQuestion.trim() || 'Analyze this single captured screen frame: explain what is shown and extract visible text.',
          factCheck
        );
      }
    } catch (err) {
      await onAnalyzeFrame('', 'image/jpeg', err instanceof Error ? err.message : 'Screen capture cancelled.', false);
    }
  };

  const syncLabel =
    memorySyncStatus === 'synced'
      ? `Synced (${memoriesCount} records)`
      : memorySyncStatus === 'syncing'
        ? 'Synchronizing...'
        : memorySyncStatus === 'offline'
          ? 'Offline Cache / Error'
          : 'Sign in to Sync';

  return (
    <div className="space-y-6">
      {/* Status strip: clean unboxed metadata */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sky-400/15 pb-4 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-200 font-medium">Owner: {ownerName}</span>
          <span aria-hidden="true">·</span>
          <span>Voice: {voiceState === 'idle' ? 'Standby' : voiceState}</span>
          <span aria-hidden="true">·</span>
          <span>Model: <span className="font-mono text-sky-300">{activeModelId}</span></span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Background Tasks:{' '}
            <span className="font-mono text-slate-200 tabular-nums">{activeTasksCount}</span>
            {runningTaskTitle ? ` (${runningTaskTitle})` : ''}
          </span>
          <span aria-hidden="true">·</span>
          <span>Memory Sync: <span className="text-cyan-300">{syncLabel}</span></span>
        </div>
      </div>

      {/* Main Focal Core + Response Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 jarvis-glass border border-sky-400/15 rounded-xl p-6 flex flex-col items-center justify-between gap-6">
          <JarvisCoreVisual
            voiceState={voiceState}
            isThinking={isThinking}
            audioLevel={audioLevel}
          />

          <div className="w-full space-y-3">
            {interimTranscript && (
              <p className="text-xs text-cyan-300 text-center font-mono">
                Hearing: &ldquo;{interimTranscript}&rdquo;
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onToggleMic}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  voiceState === 'listening'
                    ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                    : 'bg-sky-600 text-white hover:bg-sky-500'
                }`}
              >
                {voiceState === 'listening' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {voiceState === 'listening' ? 'Stop Listening' : 'Speak to JARVIS'}
              </button>

              {voiceState === 'speaking' && (
                <button
                  type="button"
                  onClick={onStopSpeaking}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-800 text-slate-100 hover:bg-slate-700 border border-sky-400/20 whitespace-nowrap shrink-0"
                >
                  <VolumeX className="w-4 h-4" />
                  Interrupt
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 jarvis-glass border border-sky-400/15 rounded-xl p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-slate-100">Assistant Output</h2>
              {latestTools.length > 0 && (
                <span className="text-xs font-mono text-cyan-300">
                  Tools: {latestTools.join(', ')}
                </span>
              )}
            </div>

            {isThinking ? (
              <div className="flex items-center gap-3 py-8 text-sky-300 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Reasoning and orchestrating tools for Mozahid...</span>
              </div>
            ) : latestError ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-4 space-y-3">
                <p className="text-sm text-rose-200">{latestError}</p>
                <button
                  type="button"
                  onClick={onRetryLast}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Request
                </button>
              </div>
            ) : (
              <div className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap max-h-72 overflow-y-auto pr-1">
                {latestReply ||
                  'Yes Mozahid, I am online and ready. Ask me in Hinglish or English to plan phone tasks, analyze a screen frame, research businesses, or build a web project.'}
              </div>
            )}

            {latestPlan && (
              <div className="rounded-lg border border-sky-400/20 bg-[#070D19] p-4 space-y-2">
                <p className="text-xs font-medium text-sky-300">
                  Android Realme 6 Automation Plan · {latestPlan.targetApp}
                </p>
                <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1">
                  {latestPlan.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {latestSeo && (
              <div className="rounded-lg border border-cyan-400/20 bg-[#070D19] p-4 space-y-1.5 text-xs">
                <p className="font-medium text-cyan-300">
                  Social SEO Draft · {latestSeo.platform}
                </p>
                <p className="text-slate-100 font-medium">{latestSeo.title}</p>
                <p className="text-slate-300">{latestSeo.caption}</p>
                <p className="text-sky-300 font-mono">{latestSeo.hashtags.join(' ')}</p>
              </div>
            )}
          </div>

          {/* Command & Multimodal Input Bar */}
          <div className="space-y-3 pt-2 border-t border-sky-400/10">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type in Hinglish or English (e.g. Hey Jarvis, YouTube kholo)..."
                className="flex-1 bg-[#060B14] border border-sky-400/20 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={isThinking || !input.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </form>

            {/* Frame / Screen Vision Quick Bar */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <input
                type="text"
                value={visionQuestion}
                onChange={(e) => setVisionQuestion(e.target.value)}
                placeholder="Optional question for screen/image frame..."
                className="flex-1 min-w-[200px] bg-[#060B14] border border-sky-400/15 rounded-md px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
              />
              <label className="inline-flex items-center gap-1.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={factCheck}
                  onChange={(e) => setFactCheck(e.target.checked)}
                  className="rounded border-sky-500/40 bg-slate-900"
                />
                Fact-check
              </label>
              <button
                type="button"
                onClick={handleCaptureScreenFrame}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-sky-400/15 whitespace-nowrap shrink-0"
              >
                <Monitor className="w-3.5 h-3.5 text-cyan-300" />
                Capture Frame
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-sky-400/15 whitespace-nowrap shrink-0"
              >
                <Camera className="w-3.5 h-3.5 text-sky-300" />
                Upload Frame
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface VoiceAssistantScreenProps {
  voiceState: VoiceEngineState;
  audioLevel: number;
  language: 'en-IN' | 'en-US' | 'hi-IN';
  wakeWordEnabled: boolean;
  ttsRate: number;
  selectedVoiceURI: string;
  availableVoices: SpeechSynthesisVoice[];
  transcriptLog: Array<{ role: string; text: string; time: string }>;
  onChangeLanguage: (lang: 'en-IN' | 'en-US' | 'hi-IN') => void;
  onToggleWakeWord: (enabled: boolean) => void;
  onChangeTtsRate: (rate: number) => void;
  onChangeVoiceURI: (uri: string) => void;
  onStartVoiceTurn: () => void;
  onStopVoice: () => void;
  onInterruptSpeech: () => void;
  onTranscribeAudioFile: (base64: string, mimeType: string) => Promise<void>;
}

export const VoiceAssistantScreen: React.FC<VoiceAssistantScreenProps> = ({
  voiceState,
  audioLevel,
  language,
  wakeWordEnabled,
  ttsRate,
  selectedVoiceURI,
  availableVoices,
  transcriptLog,
  onChangeLanguage,
  onToggleWakeWord,
  onChangeTtsRate,
  onChangeVoiceURI,
  onStartVoiceTurn,
  onStopVoice,
  onInterruptSpeech,
  onTranscribeAudioFile,
}) => {
  const audioUploadRef = useRef<HTMLInputElement | null>(null);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result || '').split(',')[1] || '';
      if (base64) await onTranscribeAudioFile(base64, file.type || 'audio/mpeg');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Voice Conversation Deck</h2>
          <span className="text-xs text-cyan-300 font-mono">{voiceState}</span>
        </div>

        <JarvisCoreVisual voiceState={voiceState} isThinking={false} audioLevel={audioLevel} compact />

        <div className="flex flex-wrap gap-2.5 justify-center">
          <button
            type="button"
            onClick={voiceState === 'listening' ? onStopVoice : onStartVoiceTurn}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium whitespace-nowrap shrink-0"
          >
            {voiceState === 'listening' ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {voiceState === 'listening' ? 'Stop Mic' : 'Start Voice Turn'}
          </button>
          <button
            type="button"
            onClick={onInterruptSpeech}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-sky-400/15 whitespace-nowrap shrink-0"
          >
            <Volume2 className="w-4 h-4" />
            Interrupt TTS
          </button>
        </div>

        <div className="space-y-4 pt-4 border-t border-sky-400/10 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-300">Recognition Language</span>
            <select
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value as 'en-IN' | 'en-US' | 'hi-IN')}
              className="bg-[#060B14] border border-sky-400/20 rounded-md px-3 py-1.5 text-xs text-slate-100"
            >
              <option value="en-IN">Hinglish (en-IN)</option>
              <option value="en-US">English (en-US)</option>
              <option value="hi-IN">Hindi / Hinglish (hi-IN)</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-300">Natural Voice Output</span>
            <select
              value={selectedVoiceURI}
              onChange={(e) => onChangeVoiceURI(e.target.value)}
              className="max-w-[200px] bg-[#060B14] border border-sky-400/20 rounded-md px-2.5 py-1.5 text-xs text-slate-100"
            >
              <option value="">Auto English Voice</option>
              {availableVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-300">Speech Rate ({ttsRate.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.75"
              max="1.4"
              step="0.05"
              value={ttsRate}
              onChange={(e) => onChangeTtsRate(Number(e.target.value))}
              className="w-36 accent-sky-500"
            />
          </div>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-slate-200 text-sm">&ldquo;Hey JARVIS&rdquo; Wake Listener</p>
              <p className="text-xs text-slate-400">
                Active only while toggled on with visible status indicator.
              </p>
            </div>
            <input
              type="checkbox"
              checked={wakeWordEnabled}
              onChange={(e) => onToggleWakeWord(e.target.checked)}
              className="w-4 h-4 accent-cyan-400"
            />
          </label>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => audioUploadRef.current?.click()}
              className="text-xs text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
            >
              Transcribe Hinglish/English audio file via Gemini Flash
            </button>
            <input
              ref={audioUploadRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>

      <div className="lg:col-span-7 jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">Live Voice Transcript</h2>
        {transcriptLog.length === 0 ? (
          <p className="text-sm text-slate-400 py-8">
            Start a voice turn and say &ldquo;Hey Jarvis&rdquo; or &ldquo;YouTube kholo&rdquo; to test natural Hinglish conversation.
          </p>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {transcriptLog.map((item, i) => (
              <div key={i} className="border-b border-sky-400/10 pb-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-medium text-sky-300">{item.role}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{item.time}</span>
                </div>
                <p className="text-sm text-slate-100">{item.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface ConversationHistoryScreenProps {
  messages: ConversationMessage[];
  onReusePrompt: (content: string) => void;
  onClearConversations?: () => void;
}

export const ConversationHistoryScreen: React.FC<ConversationHistoryScreenProps> = ({
  messages,
  onReusePrompt,
  onClearConversations,
}) => {
  const [search, setSearch] = useState('');
  const filtered = messages.filter((m) =>
    !search.trim()
      ? true
      : m.content.toLowerCase().includes(search.toLowerCase()) ||
        m.channel.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Conversation History</h2>
          <p className="text-xs text-slate-400">
            Persisted across sessions in Firebase ({messages.length} turns)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search previous conversations..."
            className="sm:w-72 bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
          />
          {messages.length > 0 && onClearConversations && (
            <button
              type="button"
              onClick={onClearConversations}
              className="px-3 py-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 text-xs text-rose-200 whitespace-nowrap shrink-0"
            >
              Clear History
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400 py-8">
          No matching conversation history found. Sign in and send a message to persist turns.
        </p>
      ) : (
        <div className="divide-y divide-sky-400/10 max-h-[520px] overflow-y-auto pr-1">
          {filtered.map((msg) => (
            <div key={msg.id} className="py-3.5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className={msg.role === 'assistant' ? 'text-cyan-300 font-medium' : 'text-sky-300 font-medium'}>
                    {msg.role === 'assistant' ? 'JARVIS' : 'Mozahid'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{msg.channel}</span>
                  {msg.modelUsed && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{msg.modelUsed}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{new Date(msg.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <button
                  type="button"
                  onClick={() => onReusePrompt(msg.content)}
                  className="text-xs text-sky-300 hover:text-sky-200 whitespace-nowrap shrink-0"
                >
                  Run Again
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
