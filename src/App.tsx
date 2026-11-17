import React, { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Activity,
  Bot,
  Code2,
  Database,
  History,
  Home,
  ListTodo,
  LogIn,
  LogOut,
  Mic,
  Settings,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  ConversationHistoryScreen,
  HomeScreen,
  VoiceAssistantScreen,
} from './components/screens/CoreScreens';
import {
  MemoryManagerScreen,
  PhoneAutomationScreen,
  TaskManagerScreen,
} from './components/screens/KnowledgeTaskScreens';
import {
  DeveloperWorkspaceScreen,
  PermissionsScreen,
  SettingsScreen,
  SystemDiagnosticsScreen,
} from './components/screens/SystemWorkspaceScreens';
import {
  auth,
  clearUserConversations,
  clearUserMemories,
  createTaskRecord,
  deleteMemoryRecord,
  ensureUserProfile,
  saveConversationMessage,
  saveMemoryRecord,
  saveWorkspaceProject,
  signInWithGooglePopup,
  signOutOwner,
  subscribeConversations,
  subscribeMemories,
  subscribeProjects,
  subscribeTasks,
  testFirestoreConnection,
  updateTaskRecord,
  updateUserProfile,
} from './services/firebaseClient';
import {
  JarvisVoiceController,
  listEnglishVoices,
  speakNatural,
  stopSpeaking,
  type VoiceEngineState,
} from './services/voiceService';
import type {
  AutomationPlan,
  ConversationMessage,
  JarvisScreenId,
  MemoryCategory,
  MemoryImportance,
  MemoryRecord,
  ModelInfo,
  PendingConfirmation,
  SocialSeoResult,
  TaskCategory,
  TaskRecord,
  UserProfileSettings,
  WorkspaceProject,
} from './types/jarvis';

const NAV_ITEMS: Array<{ id: JarvisScreenId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'voice', label: 'Voice Assistant', icon: Mic },
  { id: 'history', label: 'Conversation History', icon: History },
  { id: 'memory', label: 'Memory Manager', icon: Database },
  { id: 'tasks', label: 'Task Manager', icon: ListTodo },
  { id: 'automation', label: 'Phone Automation', icon: Smartphone },
  { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'developer', label: 'Developer Workspace', icon: Code2 },
  { id: 'diagnostics', label: 'System Diagnostics', icon: Activity },
];

const DEFAULT_SETTINGS: UserProfileSettings = {
  userId: '',
  ownerName: 'Mozahid',
  deviceModel: 'Realme 6',
  primaryLanguage: 'Hinglish',
  secondaryLanguage: 'English',
  activeModelId: 'gemini-4-hydrogen',
  realtimeDatabaseUrl: '',
  wakeWordEnabled: false,
  ttsRate: 1.0,
  confirmSensitiveActions: true,
  createdAt: '',
  updatedAt: '',
};

function JarvisAppShell() {
  const [activeScreen, setActiveScreen] = useState<JarvisScreenId>('home');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [settings, setSettings] = useState<UserProfileSettings>(DEFAULT_SETTINGS);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [activeProject, setActiveProject] = useState<WorkspaceProject | null>(null);
  const [memorySyncStatus, setMemorySyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'unauthenticated'>(
    'unauthenticated'
  );

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [firestoreStatus, setFirestoreStatus] = useState<{ connected: boolean; message: string }>({
    connected: false,
    message: 'Checking Firebase...',
  });
  const [rtdbStatus, setRtdbStatus] = useState<{
    configured: boolean;
    validFormat: boolean;
    reachable: boolean;
    rulesProtected?: boolean;
    message: string;
  }>({
    configured: false,
    validFormat: false,
    reachable: false,
    message: 'Checking Realtime Database status...',
  });
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);

  const [isThinking, setIsThinking] = useState(false);
  const [latestReply, setLatestReply] = useState('');
  const [latestError, setLatestError] = useState<string | null>(null);
  const [latestTools, setLatestTools] = useState<string[]>([]);
  const [latestPlan, setLatestPlan] = useState<AutomationPlan | null>(null);
  const [latestSeo, setLatestSeo] = useState<SocialSeoResult | null>(null);
  const [lastPrompt, setLastPrompt] = useState('');

  const [voiceState, setVoiceState] = useState<VoiceEngineState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState<'en-IN' | 'en-US' | 'hi-IN'>('en-IN');
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceTranscriptLog, setVoiceTranscriptLog] = useState<Array<{ role: string; text: string; time: string }>>([]);

  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const voiceControllerRef = useRef<JarvisVoiceController>(new JarvisVoiceController());

  const refreshDiagnostics = useCallback(async () => {
    const [fsRes, modelsRes, rtdbRes, healthRes] = await Promise.all([
      testFirestoreConnection(),
      fetch('/api/jarvis/models')
        .then((r) => r.json())
        .catch(() => ({ models: [] })),
      fetch('/api/jarvis/rtdb/status')
        .then((r) => r.json())
        .catch(() => ({
          configured: false,
          validFormat: false,
          reachable: false,
          message: 'Unable to reach /api/jarvis/rtdb/status',
        })),
      fetch('/api/jarvis/health')
        .then((r) => r.json())
        .catch(() => null),
    ]);
    setFirestoreStatus(fsRes);
    if (Array.isArray(modelsRes.models)) {
      setModels(modelsRes.models);
    }
    if (rtdbRes && typeof rtdbRes.message === 'string') {
      setRtdbStatus(rtdbRes);
    }
    if (healthRes && typeof healthRes.geminiConfigured === 'boolean') {
      setGeminiConfigured(healthRes.geminiConfigured);
    }
  }, []);

  useEffect(() => {
    void refreshDiagnostics();

    const loadVoices = () => setAvailableVoices(listEnglishVoices());
    loadVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      voiceControllerRef.current.stop();
      stopSpeaking();
    };
  }, [refreshDiagnostics]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (!firebaseUser) {
        setMemorySyncStatus('unauthenticated');
        setMemories([]);
        setConversations([]);
        setTasks([]);
        setProjects([]);
        return;
      }

      setMemorySyncStatus('syncing');
      try {
        const profile = await ensureUserProfile(firebaseUser.uid, DEFAULT_SETTINGS);
        setSettings(profile);
      } catch (err) {
        setMemorySyncStatus('offline');
        setLatestError(err instanceof Error ? err.message : 'Failed to initialize owner profile.');
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const onSubError = (err: Error) => {
      setMemorySyncStatus('offline');
      setLatestError(err.message);
    };

    const unsubMem = subscribeMemories(
      uid,
      (items) => {
        setMemories(items);
        setMemorySyncStatus('synced');
      },
      onSubError
    );
    const unsubConv = subscribeConversations(uid, setConversations, onSubError);
    const unsubTasks = subscribeTasks(uid, setTasks, onSubError);
    const unsubProj = subscribeProjects(
      uid,
      (items) => {
        setProjects(items);
        if (items.length > 0 && !activeProject) {
          setActiveProject(items[0]);
        }
      },
      onSubError
    );

    return () => {
      unsubMem();
      unsubConv();
      unsubTasks();
      unsubProj();
    };
  }, [user, activeProject]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    }
  };

  const speakIfEnabled = useCallback(
    (text: string) => {
      speakNatural(text, {
        rate: settings.ttsRate,
        voiceURI: selectedVoiceURI,
        onStart: () => setVoiceState('speaking'),
        onEnd: () => setVoiceState('idle'),
      });
    },
    [settings.ttsRate, selectedVoiceURI]
  );

  const sendAgentCommand = useCallback(
    async (text: string, speakReply = false, channel: 'text' | 'voice' = 'text') => {
      const clean = text.trim();
      if (!clean) return;

      setLastPrompt(clean);
      setIsThinking(true);
      setLatestError(null);
      setLatestPlan(null);

      try {
        if (user) {
          await saveConversationMessage(
            user.uid,
            { sessionId: 'main', role: 'user', content: clean, channel },
            settings.realtimeDatabaseUrl
          );
        }

        const response = await fetch('/api/jarvis/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: clean,
            modelId: settings.activeModelId,
            deviceContext: {
              ownerName: settings.ownerName,
              deviceModel: settings.deviceModel,
              primaryLanguage: settings.primaryLanguage,
              channel,
            },
            memories: memories.slice(0, 12).map((m) => `[${m.category}] ${m.title}: ${m.content}`),
            history: conversations.slice(-10).map((c) => ({ role: c.role, content: c.content })),
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Request failed (${response.status})`);
        }

        let replyText = String(data.reply || '');
        const toolNames: string[] = Array.isArray(data.executedTools)
          ? data.executedTools.map((t: { name: string }) => t.name)
          : [];

        // Persist queued memory actions honestly
        if (Array.isArray(data.memoryActions) && data.memoryActions.length > 0) {
          if (!user) {
            replyText +=
              '\n\n(Note: Sign in with Google so I can persist this memory in Firebase—I will not claim it is saved until written.)';
          } else {
            for (const m of data.memoryActions) {
              await saveMemoryRecord(
                user.uid,
                {
                  category: m.category || 'instruction',
                  title: String(m.title || 'JARVIS Memory'),
                  content: String(m.content || ''),
                  importance: m.importance || 'normal',
                  tags: Array.isArray(m.tags) ? m.tags : [],
                },
                settings.realtimeDatabaseUrl
              );
            }
          }
        }

        if (Array.isArray(data.taskActions) && data.taskActions.length > 0 && user) {
          for (const t of data.taskActions) {
            await createTaskRecord(
              user.uid,
              {
                title: String(t.title || 'JARVIS Task'),
                category: t.category || 'automation',
                description: String(t.description || ''),
                status: 'queued',
                progress: 10,
              },
              settings.realtimeDatabaseUrl
            );
          }
        }

        if (data.automationPlan) {
          setLatestPlan(data.automationPlan as AutomationPlan);
        }
        if (data.socialSeo) {
          setLatestSeo(data.socialSeo as SocialSeoResult);
        }
        if (data.generatedProject) {
          const gp = data.generatedProject as {
            name: string;
            stack: string;
            summary: string;
            entryHtml: string;
            entryCss: string;
            entryJs: string;
          };
          if (user) {
            const id = await saveWorkspaceProject(user.uid, gp, settings.realtimeDatabaseUrl);
            setActiveProject({
              ...gp,
              id,
              userId: user.uid,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } else {
            setActiveProject({
              ...gp,
              id: `local_${Date.now()}`,
              userId: 'local',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          setActiveScreen('developer');
        }

        if (data.pendingConfirmation) {
          setPendingConfirmation({
            id: `conf_${Date.now()}`,
            title: data.pendingConfirmation.title,
            description: data.pendingConfirmation.action,
            actionType: 'automation',
            onConfirm: () => {
              setLatestReply(`Confirmed by Mozahid: ${data.pendingConfirmation.title}. Dispatching safe action plan.`);
              setPendingConfirmation(null);
            },
          });
        }

        setLatestReply(replyText);
        setLatestTools(toolNames);

        if (user) {
          await saveConversationMessage(
            user.uid,
            {
              sessionId: 'main',
              role: 'assistant',
              content: replyText,
              channel,
              modelUsed: data.modelUsed,
              toolSummary: toolNames.join(', '),
            },
            settings.realtimeDatabaseUrl
          );
        }

        if (speakReply) {
          speakIfEnabled(replyText);
          setVoiceTranscriptLog((prev) => [
            ...prev,
            { role: 'Mozahid', text: clean, time: new Date().toLocaleTimeString() },
            { role: 'JARVIS', text: replyText, time: new Date().toLocaleTimeString() },
          ]);
        }
      } catch (err) {
        setLatestError(err instanceof Error ? err.message : 'Unexpected agent error.');
      } finally {
        setIsThinking(false);
      }
    },
    [user, settings, memories, conversations, speakIfEnabled]
  );

  const startVoiceTurn = useCallback(
    (continuousWake = false) => {
      voiceControllerRef.current.startListening({
        lang: voiceLanguage,
        continuous: continuousWake,
        onStateChange: setVoiceState,
        onInterim: setInterimTranscript,
        onLevel: setAudioLevel,
        onError: (msg) => setLatestError(msg),
        onFinal: (transcript) => {
          setInterimTranscript('');
          if (continuousWake) {
            const lower = transcript.toLowerCase();
            if (lower.includes('hey jarvis') || lower.includes('jarvis')) {
              const cleaned = transcript.replace(/hey\s+jarvis/i, '').trim() || 'Hey Jarvis';
              void sendAgentCommand(cleaned, true, 'voice');
            }
          } else {
            void sendAgentCommand(transcript, true, 'voice');
          }
        },
      });
    },
    [voiceLanguage, sendAgentCommand]
  );

  const toggleMic = () => {
    if (voiceState === 'listening' || voiceState === 'wake_standby') {
      voiceControllerRef.current.stop();
      setVoiceState('idle');
    } else {
      startVoiceTurn(false);
    }
  };

  const handleAnalyzeFrame = async (
    base64: string,
    mimeType: string,
    question: string,
    factCheck: boolean
  ) => {
    if (!base64) {
      setLatestError(question);
      return;
    }
    setIsThinking(true);
    setLatestError(null);
    try {
      const res = await fetch('/api/jarvis/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          question,
          factCheck,
          modelId: settings.activeModelId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Vision analysis failed.');
      setLatestReply(data.analysis);
      setLatestTools(['multimodal_vision']);
    } catch (err) {
      setLatestError(err instanceof Error ? err.message : 'Vision request failed.');
    } finally {
      setIsThinking(false);
    }
  };

  const handleTranscribeAudio = async (base64: string, mimeType: string) => {
    setIsThinking(true);
    setLatestError(null);
    try {
      const res = await fetch('/api/jarvis/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64, mimeType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription failed.');
      if (data.transcript) {
        await sendAgentCommand(data.transcript, true, 'voice');
      }
    } catch (err) {
      setLatestError(err instanceof Error ? err.message : 'Audio transcription error.');
      setIsThinking(false);
    }
  };

  const handleMapsResearch = async (query: string) => {
    const res = await fetch('/api/jarvis/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, mode: 'maps', modelId: settings.activeModelId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Maps research failed.');
    return { summary: String(data.summary || ''), chunks: data.groundingChunks || [] };
  };

  const activeTasksCount = tasks.filter(
    (t) => t.status === 'queued' || t.status === 'running' || t.status === 'awaiting_confirmation'
  ).length;
  const runningTaskTitle = tasks.find((t) => t.status === 'running')?.title || null;

  return (
    <div className="min-h-screen bg-[#04070D] text-slate-100 flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <aside className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-sky-400/15 bg-[#070C17] flex flex-col">
        <div className="px-5 py-4 border-b border-sky-400/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-cyan-300" />
            <span className="font-display text-lg font-bold tracking-[0.14em] text-slate-100 whitespace-nowrap">
              JARVIS
            </span>
          </div>
          <span className="text-[11px] font-mono text-sky-300 lg:hidden">Mozahid</span>
        </div>

        <nav className="flex lg:flex-col gap-1 p-3 overflow-x-auto lg:overflow-x-visible">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveScreen(item.id)}
                className={`inline-flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-sky-600/25 text-cyan-200 border border-sky-400/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: 3 zones */}
        <header className="px-6 py-3.5 border-b border-sky-400/15 bg-[#060B15]/80 flex items-center justify-between gap-8">
          <span className="font-display text-sm font-semibold text-slate-100 whitespace-nowrap shrink-0">
            {NAV_ITEMS.find((n) => n.id === activeScreen)?.label}
          </span>

          <div className="hidden md:flex items-center gap-6 text-xs text-slate-400">
            <span className="whitespace-nowrap shrink-0">Device: {settings.deviceModel}</span>
            <span className="whitespace-nowrap shrink-0">Language: {settings.primaryLanguage}</span>
            <span className="whitespace-nowrap shrink-0 font-mono text-sky-300">
              {settings.activeModelId}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {authLoading ? (
              <span className="text-xs text-slate-400">Auth...</span>
            ) : user ? (
              <button
                type="button"
                onClick={() => void signOutOwner()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-sky-400/20 whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out ({user.displayName?.split(' ')[0] || 'Owner'})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSignIn()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs text-white font-medium whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In with Google
              </button>
            )}
          </div>
        </header>

        {authError && (
          <div className="mx-6 mt-4 rounded-lg border border-rose-500/30 bg-rose-950/20 px-4 py-2.5 text-xs text-rose-200">
            {authError}
          </div>
        )}

        <main className="flex-1 p-6 max-w-6xl w-full mx-auto">
          {activeScreen === 'home' && (
            <HomeScreen
              ownerName={settings.ownerName}
              activeModelId={settings.activeModelId}
              voiceState={voiceState}
              audioLevel={audioLevel}
              isThinking={isThinking}
              latestReply={latestReply}
              latestError={latestError}
              latestTools={latestTools}
              latestPlan={latestPlan}
              latestSeo={latestSeo}
              activeTasksCount={activeTasksCount}
              runningTaskTitle={runningTaskTitle}
              memorySyncStatus={memorySyncStatus}
              memoriesCount={memories.length}
              interimTranscript={interimTranscript}
              onSendCommand={(text, speak) => sendAgentCommand(text, speak, 'text')}
              onToggleMic={toggleMic}
              onStopSpeaking={() => {
                stopSpeaking();
                setVoiceState('idle');
              }}
              onAnalyzeFrame={handleAnalyzeFrame}
              onRetryLast={() => {
                if (lastPrompt) void sendAgentCommand(lastPrompt);
              }}
            />
          )}

          {activeScreen === 'voice' && (
            <VoiceAssistantScreen
              voiceState={voiceState}
              audioLevel={audioLevel}
              language={voiceLanguage}
              wakeWordEnabled={settings.wakeWordEnabled}
              ttsRate={settings.ttsRate}
              selectedVoiceURI={selectedVoiceURI}
              availableVoices={availableVoices}
              transcriptLog={voiceTranscriptLog}
              onChangeLanguage={setVoiceLanguage}
              onToggleWakeWord={(enabled) => {
                setSettings((s) => ({ ...s, wakeWordEnabled: enabled }));
                if (user) void updateUserProfile(user.uid, { wakeWordEnabled: enabled });
                if (enabled) startVoiceTurn(true);
                else voiceControllerRef.current.stop();
              }}
              onChangeTtsRate={(rate) => {
                setSettings((s) => ({ ...s, ttsRate: rate }));
                if (user) void updateUserProfile(user.uid, { ttsRate: rate });
              }}
              onChangeVoiceURI={setSelectedVoiceURI}
              onStartVoiceTurn={() => startVoiceTurn(false)}
              onStopVoice={() => {
                voiceControllerRef.current.stop();
                setVoiceState('idle');
              }}
              onInterruptSpeech={() => {
                stopSpeaking();
                setVoiceState('idle');
              }}
              onTranscribeAudioFile={handleTranscribeAudio}
            />
          )}

          {activeScreen === 'history' && (
            <ConversationHistoryScreen
              messages={conversations}
              onReusePrompt={(prompt) => {
                setActiveScreen('home');
                void sendAgentCommand(prompt);
              }}
              onClearConversations={
                user
                  ? () => {
                      setPendingConfirmation({
                        id: `clear_conv_${Date.now()}`,
                        title: 'Clear Conversation History',
                        description:
                          'This permanently deletes all saved conversation turns for your account in Firebase. Proceed?',
                        actionType: 'clear_conversations',
                        onConfirm: async () => {
                          await clearUserConversations(user.uid, settings.realtimeDatabaseUrl);
                          setPendingConfirmation(null);
                        },
                      });
                    }
                  : undefined
              }
            />
          )}

          {activeScreen === 'memory' && (
            <MemoryManagerScreen
              memories={memories}
              isAuthenticated={Boolean(user)}
              onSaveMemory={async (payload) => {
                if (!user) return;
                await saveMemoryRecord(user.uid, payload, settings.realtimeDatabaseUrl);
              }}
              onDeleteMemory={(mem) => {
                if (!user) return;
                setPendingConfirmation({
                  id: `del_${mem.id}`,
                  title: `Delete Memory: ${mem.title}`,
                  description: 'Deleting this memory removes it from Firebase permanently. Proceed?',
                  actionType: 'delete_memory',
                  onConfirm: async () => {
                    await deleteMemoryRecord(user.uid, mem.id, settings.realtimeDatabaseUrl);
                    setPendingConfirmation(null);
                  },
                });
              }}
              onClearAllMemories={
                user
                  ? () => {
                      setPendingConfirmation({
                        id: `clear_mem_${Date.now()}`,
                        title: 'Clear All Long-Term Memories',
                        description:
                          'This permanently deletes all saved memories for your account in Firebase. Proceed?',
                        actionType: 'clear_memories',
                        onConfirm: async () => {
                          await clearUserMemories(user.uid, settings.realtimeDatabaseUrl);
                          setPendingConfirmation(null);
                        },
                      });
                    }
                  : undefined
              }
            />
          )}

          {activeScreen === 'tasks' && (
            <TaskManagerScreen
              tasks={tasks}
              isAuthenticated={Boolean(user)}
              onCreateTask={async (title, category, description) => {
                if (!user) return;
                await createTaskRecord(
                  user.uid,
                  { title, category, description, status: 'queued', progress: 10 },
                  settings.realtimeDatabaseUrl
                );
              }}
              onRetryTask={async (task) => {
                if (!user) return;
                await updateTaskRecord(user.uid, task.id, {
                  status: 'running',
                  progress: 25,
                  retryCount: task.retryCount + 1,
                });
              }}
              onCancelTask={async (task) => {
                if (!user) return;
                await updateTaskRecord(user.uid, task.id, {
                  status: 'cancelled',
                  progress: task.progress,
                });
              }}
              onCompleteTask={async (task) => {
                if (!user) return;
                await updateTaskRecord(user.uid, task.id, {
                  status: 'completed',
                  progress: 100,
                });
              }}
            />
          )}

          {activeScreen === 'automation' && (
            <PhoneAutomationScreen
              onSendAgentCommand={async (prompt) => {
                setActiveScreen('home');
                await sendAgentCommand(prompt);
              }}
              onMapsResearchToWebsite={handleMapsResearch}
              onGenerateWebsiteFromResearch={async (summary, query) => {
                await sendAgentCommand(
                  `Using ONLY these verified public business details for "${query}", call generate_website_project to create a premium responsive business demo website:\n\n${summary}`
                );
              }}
              latestSeo={latestSeo}
            />
          )}

          {activeScreen === 'permissions' && <PermissionsScreen />}

          {activeScreen === 'settings' && (
            <SettingsScreen
              settings={settings}
              models={models}
              isAuthenticated={Boolean(user)}
              onSaveSettings={async (updates) => {
                if (!user) return;
                await updateUserProfile(user.uid, updates);
                setSettings((prev) => ({ ...prev, ...updates }));
              }}
              onSwitchServerModel={async (modelId) => {
                const res = await fetch('/api/jarvis/config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ modelId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Model update rejected.');
                setSettings((prev) => ({ ...prev, activeModelId: data.activeModelId }));
              }}
            />
          )}

          {activeScreen === 'developer' && (
            <DeveloperWorkspaceScreen
              projects={projects}
              activeProject={activeProject}
              isAuthenticated={Boolean(user)}
              onSelectProject={setActiveProject}
              onSaveProject={async (project, requireOverwriteConfirm) => {
                if (!user) return;
                if (requireOverwriteConfirm && settings.confirmSensitiveActions) {
                  setPendingConfirmation({
                    id: `overwrite_${Date.now()}`,
                    title: `Overwrite Project: ${project.name}`,
                    description: 'This will overwrite existing project files in Firebase. Confirm update?',
                    actionType: 'overwrite_project',
                    onConfirm: async () => {
                      await saveWorkspaceProject(user.uid, project, settings.realtimeDatabaseUrl);
                      setPendingConfirmation(null);
                    },
                  });
                } else {
                  await saveWorkspaceProject(user.uid, project, settings.realtimeDatabaseUrl);
                }
              }}
              onAskAgentToBuild={(prompt) => sendAgentCommand(prompt)}
            />
          )}

          {activeScreen === 'diagnostics' && (
            <SystemDiagnosticsScreen
              models={models}
              activeModelId={settings.activeModelId}
              firestoreStatus={firestoreStatus}
              rtdbUrl={settings.realtimeDatabaseUrl}
              rtdbStatus={rtdbStatus}
              geminiConfigured={geminiConfigured}
              onRefreshDiagnostics={refreshDiagnostics}
            />
          )}
        </main>
      </div>

      {/* Explicit Confirmation Modal for Sensitive Actions */}
      {pendingConfirmation && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full jarvis-glass border border-sky-400/30 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-100">{pendingConfirmation.title}</h3>
            <p className="text-sm text-slate-300">{pendingConfirmation.description}</p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingConfirmation(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void pendingConfirmation.onConfirm()}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs text-white font-medium"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <JarvisAppShell />
    </ErrorBoundary>
  );
}
