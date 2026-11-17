import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Code2,
  Download,
  Eye,
  FolderCode,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type { ModelInfo, UserProfileSettings, WorkspaceProject } from '../../types/jarvis';

interface PermissionsScreenProps {
  onRefreshDiagnostics?: () => void;
}

export const PermissionsScreen: React.FC<PermissionsScreenProps> = () => {
  const [micStatus, setMicStatus] = useState<string>('Checking...');
  const [camStatus, setCamStatus] = useState<string>('Checking...');
  const [notifStatus, setNotifStatus] = useState<string>('Checking...');
  const [probeMsg, setProbeMsg] = useState<string | null>(null);

  const checkBrowserPermissions = async () => {
    try {
      if ('Notification' in window) {
        setNotifStatus(Notification.permission);
      } else {
        setNotifStatus('unsupported');
      }

      if (navigator.permissions?.query) {
        const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicStatus(mic.state);
        const cam = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCamStatus(cam.state);
      } else {
        setMicStatus('prompt');
        setCamStatus('prompt');
      }
    } catch {
      setMicStatus('prompt');
      setCamStatus('prompt');
    }
  };

  useEffect(() => {
    void checkBrowserPermissions();
  }, []);

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setProbeMsg('Microphone access granted.');
      await checkBrowserPermissions();
    } catch (err) {
      setProbeMsg(err instanceof Error ? err.message : 'Microphone permission denied.');
    }
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) return;
    const res = await Notification.requestPermission();
    setNotifStatus(res);
    setProbeMsg(`Notification permission: ${res}`);
  };

  const androidPermissions = [
    {
      name: 'Microphone (RECORD_AUDIO)',
      scope: 'Hinglish & English speech recognition + opt-in foreground voice listener',
      mode: 'Contextual runtime dialog',
    },
    {
      name: 'Contacts (READ_CONTACTS)',
      scope: 'Search Mozahid’s contacts and resolve matching names before calling',
      mode: 'Contextual runtime dialog',
    },
    {
      name: 'Phone (CALL_PHONE)',
      scope: 'Optional direct dialing after explicit confirmation; safe ACTION_DIAL fallback',
      mode: 'Contextual runtime dialog',
    },
    {
      name: 'Notifications (POST_NOTIFICATIONS)',
      scope: 'Visible foreground notifications for microphone, MediaProjection, and WorkManager',
      mode: 'Contextual runtime dialog (Android 13+)',
    },
    {
      name: 'Accessibility Service',
      scope: 'Read accessible UI nodes, scroll, tap, enter text, CapCut & app navigation',
      mode: 'Explicitly enabled by Mozahid in Android Settings',
    },
    {
      name: 'MediaProjection (Screen Capture)',
      scope: 'Single-frame analysis for video/screen questions; respects FLAG_SECURE apps',
      mode: 'System consent dialog per capture session',
    },
    {
      name: 'Camera (CAMERA)',
      scope: 'Requested only when capturing visual context from device camera',
      mode: 'Contextual runtime dialog',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Browser Command Center Permissions</h2>
            <p className="text-xs text-slate-400">
              Permissions are requested contextually with clear explanation—never silently bypassed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void checkBrowserPermissions()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-sky-400/15"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-sky-400/15 bg-[#070E1C] p-4 space-y-2">
            <p className="text-sm font-medium text-slate-100">Microphone</p>
            <p className="text-xs font-mono text-cyan-300">State: {micStatus}</p>
            <button
              type="button"
              onClick={() => void requestMic()}
              className="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-xs text-white font-medium"
            >
              Request Microphone
            </button>
          </div>

          <div className="rounded-lg border border-sky-400/15 bg-[#070E1C] p-4 space-y-2">
            <p className="text-sm font-medium text-slate-100">Camera</p>
            <p className="text-xs font-mono text-cyan-300">State: {camStatus}</p>
            <p className="text-xs text-slate-400">Requested only when capturing camera media.</p>
          </div>

          <div className="rounded-lg border border-sky-400/15 bg-[#070E1C] p-4 space-y-2">
            <p className="text-sm font-medium text-slate-100">Notifications</p>
            <p className="text-xs font-mono text-cyan-300">State: {notifStatus}</p>
            <button
              type="button"
              onClick={() => void requestNotifications()}
              className="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-xs text-white font-medium"
            >
              Allow Notifications
            </button>
          </div>
        </div>

        {probeMsg && <p className="text-xs text-cyan-300">{probeMsg}</p>}
      </div>

      <div className="jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">Android Realme 6 Permission Model</h2>
        <div className="divide-y divide-sky-400/10">
          {androidPermissions.map((perm) => (
            <div key={perm.name} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-100">{perm.name}</p>
                <p className="text-xs text-slate-400">{perm.scope}</p>
              </div>
              <span className="text-xs font-mono text-sky-300 whitespace-nowrap">{perm.mode}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface SettingsScreenProps {
  settings: UserProfileSettings;
  models: ModelInfo[];
  isAuthenticated: boolean;
  onSaveSettings: (updates: Partial<UserProfileSettings>) => Promise<void>;
  onSwitchServerModel: (modelId: string) => Promise<void>;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  models,
  isAuthenticated,
  onSaveSettings,
  onSwitchServerModel,
}) => {
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [deviceModel, setDeviceModel] = useState(settings.deviceModel);
  const [primaryLanguage, setPrimaryLanguage] = useState<'Hinglish' | 'English'>(settings.primaryLanguage);
  const [activeModelId, setActiveModelId] = useState(settings.activeModelId);
  const [rtdbUrl, setRtdbUrl] = useState(settings.realtimeDatabaseUrl);
  const [confirmSensitive, setConfirmSensitive] = useState(settings.confirmSensitiveActions);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setOwnerName(settings.ownerName);
    setDeviceModel(settings.deviceModel);
    setPrimaryLanguage(settings.primaryLanguage);
    setActiveModelId(settings.activeModelId);
    setRtdbUrl(settings.realtimeDatabaseUrl);
    setConfirmSensitive(settings.confirmSensitiveActions);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await onSwitchServerModel(activeModelId.trim());
      if (isAuthenticated) {
        await onSaveSettings({
          ownerName: ownerName.trim() || 'Mozahid',
          deviceModel: deviceModel.trim() || 'Realme 6',
          primaryLanguage,
          secondaryLanguage: primaryLanguage === 'Hinglish' ? 'English' : 'Hinglish',
          activeModelId: activeModelId.trim(),
          realtimeDatabaseUrl: rtdbUrl.trim(),
          confirmSensitiveActions: confirmSensitive,
        });
      }
      setStatusMsg('Configuration saved and model service updated.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-6 max-w-3xl"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-100">JARVIS Owner &amp; Model Settings</h2>
        <p className="text-xs text-slate-400">
          Configurable model service (Flash-Lite and deprecated model IDs are blocked) and Singapore Realtime Database URL.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="space-y-1.5 text-xs text-slate-300">
          <span>Owner Name</span>
          <input
            type="text"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="w-full bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-1.5 text-xs text-slate-300">
          <span>Primary Device</span>
          <input
            type="text"
            value={deviceModel}
            onChange={(e) => setDeviceModel(e.target.value)}
            className="w-full bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-1.5 text-xs text-slate-300">
          <span>Primary Language</span>
          <select
            value={primaryLanguage}
            onChange={(e) => setPrimaryLanguage(e.target.value as 'Hinglish' | 'English')}
            className="w-full bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-sm text-slate-100"
          >
            <option value="Hinglish">Hinglish (Primary)</option>
            <option value="English">English</option>
          </select>
        </label>

        <label className="space-y-1.5 text-xs text-slate-300">
          <span>Active Gemini Model ID</span>
          <select
            value={activeModelId}
            onChange={(e) => setActiveModelId(e.target.value)}
            className="w-full bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-sm font-mono text-slate-100"
          >
            <option value="gemini-4-hydrogen">gemini-4-hydrogen (Active Flash)</option>
            {models
              .filter((m) => m.id !== 'gemini-4-hydrogen' && m.supportsFunctionCalling)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} ({m.label})
                </option>
              ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1.5 text-xs text-slate-300">
        <span>Singapore Firebase Realtime Database URL (jarvis-7402c)</span>
        <input
          type="url"
          value={rtdbUrl}
          onChange={(e) => setRtdbUrl(e.target.value)}
          placeholder="https://<database-name>.asia-southeast1.firebasedatabase.app"
          className="w-full bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-sm font-mono text-slate-100"
        />
      </label>

      <label className="flex items-center justify-between gap-4 border-t border-sky-400/10 pt-4 cursor-pointer">
        <div>
          <p className="text-sm text-slate-200">Require Confirmation Before Sensitive Actions</p>
          <p className="text-xs text-slate-400">
            Calls, messages, publishing, app installs, deletions, and file overwrites.
          </p>
        </div>
        <input
          type="checkbox"
          checked={confirmSensitive}
          onChange={(e) => setConfirmSensitive(e.target.checked)}
          className="w-4 h-4 accent-sky-500"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {statusMsg && <span className="text-xs text-cyan-300">{statusMsg}</span>}
        {errorMsg && <span className="text-xs text-rose-300">{errorMsg}</span>}
      </div>
    </form>
  );
};

interface DeveloperWorkspaceScreenProps {
  projects: WorkspaceProject[];
  activeProject: WorkspaceProject | null;
  isAuthenticated: boolean;
  onSelectProject: (p: WorkspaceProject) => void;
  onSaveProject: (
    project: {
      id?: string;
      name: string;
      stack: string;
      summary: string;
      entryHtml: string;
      entryCss: string;
      entryJs: string;
      sourceNotes?: string;
    },
    requireOverwriteConfirm: boolean
  ) => Promise<void>;
  onAskAgentToBuild: (prompt: string) => Promise<void>;
}

export const DeveloperWorkspaceScreen: React.FC<DeveloperWorkspaceScreenProps> = ({
  projects,
  activeProject,
  isAuthenticated,
  onSelectProject,
  onSaveProject,
  onAskAgentToBuild,
}) => {
  const [tab, setTab] = useState<'web' | 'android'>('web');
  const [name, setName] = useState(activeProject?.name || 'jarvis-demo-site');
  const [stack, setStack] = useState(activeProject?.stack || 'HTML/CSS/JS');
  const [html, setHtml] = useState(
    activeProject?.entryHtml ||
      '<!doctype html>\n<html>\n<head><title>Demo</title></head>\n<body>\n  <main class="hero">\n    <h1>JARVIS Workspace Ready</h1>\n    <p>Ask JARVIS to generate or edit responsive HTML, CSS, JS, React, or Kotlin code.</p>\n  </main>\n</body>\n</html>'
  );
  const [css, setCss] = useState(
    activeProject?.entryCss ||
      'body { margin: 0; font-family: system-ui, sans-serif; background: #070d19; color: #f8fafc; }\n.hero { padding: 48px 24px; max-width: 820px; margin: 0 auto; }'
  );
  const [js, setJs] = useState(activeProject?.entryJs || 'console.log("JARVIS workspace preview active");');
  const [buildPrompt, setBuildPrompt] = useState('');
  const [activeCodeFile, setActiveCodeFile] = useState<'html' | 'css' | 'js'>('html');
  const [showPreview, setShowPreview] = useState(true);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const [androidTree, setAndroidTree] = useState<Array<{ path: string; size: number }>>([]);
  const [selectedAndroidPath, setSelectedAndroidPath] = useState<string>('');
  const [selectedAndroidCode, setSelectedAndroidCode] = useState<string>('');
  const [androidLoading, setAndroidLoading] = useState(false);

  useEffect(() => {
    if (!activeProject) return;
    setName(activeProject.name);
    setStack(activeProject.stack);
    setHtml(activeProject.entryHtml);
    setCss(activeProject.entryCss);
    setJs(activeProject.entryJs);
  }, [activeProject]);

  useEffect(() => {
    if (tab === 'android' && androidTree.length === 0) {
      setAndroidLoading(true);
      fetch('/api/android/tree')
        .then((r) => r.json())
        .then((data) => {
          const files = data.files || [];
          setAndroidTree(files);
          if (files.length > 0) {
            void loadAndroidFile(files[0].path);
          }
        })
        .finally(() => setAndroidLoading(false));
    }
  }, [tab, androidTree.length]);

  const loadAndroidFile = async (filePath: string) => {
    setSelectedAndroidPath(filePath);
    const res = await fetch(`/api/android/file?path=${encodeURIComponent(filePath)}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedAndroidCode(data.content || '');
    }
  };

  const previewDoc = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;

  const handleSave = async () => {
    const existingMatch = projects.find(
      (p) => p.name.toLowerCase() === name.trim().toLowerCase() && p.id !== activeProject?.id
    );
    await onSaveProject(
      {
        id: activeProject?.id,
        name: name.trim() || 'untitled-project',
        stack: stack.trim() || 'HTML/CSS/JS',
        summary: activeProject?.summary || 'Workspace web project',
        entryHtml: html,
        entryCss: css,
        entryJs: js,
      },
      Boolean(existingMatch || activeProject?.id)
    );
    setSaveFeedback('Project sync requested.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#060B14] rounded-lg border border-sky-400/15">
          <button
            type="button"
            onClick={() => setTab('web')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
              tab === 'web' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Web Project Studio
          </button>
          <button
            type="button"
            onClick={() => setTab('android')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
              tab === 'android' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderCode className="w-3.5 h-3.5" />
            Android Kotlin Project ({androidTree.length || '30+'})
          </button>
        </div>

        <a
          href="/api/android/download"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 text-xs font-semibold whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Download Android Studio ZIP
        </a>
      </div>

      {tab === 'web' ? (
        <div className="space-y-4">
          <div className="jarvis-glass border border-sky-400/15 rounded-xl p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
            <input
              type="text"
              value={buildPrompt}
              onChange={(e) => setBuildPrompt(e.target.value)}
              placeholder="Ask JARVIS to generate a responsive website, landing page, or admin panel..."
              className="flex-1 bg-[#060B14] border border-sky-400/20 rounded-lg px-3.5 py-2 text-sm text-slate-100"
            />
            <button
              type="button"
              onClick={() => {
                if (!buildPrompt.trim()) return;
                void onAskAgentToBuild(
                  `Use generate_website_project to build a responsive production-quality website for: ${buildPrompt.trim()}`
                );
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate with JARVIS
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 jarvis-glass border border-sky-400/15 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-200">Saved Projects ({projects.length})</p>
              {projects.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Generate or save a project to organize it across sessions.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelectProject(p)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        activeProject?.id === p.id
                          ? 'bg-sky-600/25 border border-sky-400/30 text-white'
                          : 'hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{p.stack}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-9 jarvis-glass border border-sky-400/15 rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-[#060B14] border border-sky-400/20 rounded-md px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                  />
                  <input
                    type="text"
                    value={stack}
                    onChange={(e) => setStack(e.target.value)}
                    className="w-28 bg-[#060B14] border border-sky-400/20 rounded-md px-2.5 py-1.5 text-xs text-slate-300 font-mono"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreview((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                  <button
                    type="button"
                    disabled={!isAuthenticated}
                    onClick={() => void handleSave()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-xs text-white font-medium"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Project
                  </button>
                </div>
              </div>

              {saveFeedback && <p className="text-xs text-cyan-300">{saveFeedback}</p>}

              <div className="flex items-center gap-2 border-b border-sky-400/10 pb-2 text-xs">
                {(['html', 'css', 'js'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setActiveCodeFile(f)}
                    className={`px-3 py-1 rounded-md font-mono ${
                      activeCodeFile === f ? 'bg-sky-600/30 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f === 'html' ? 'index.html' : f === 'css' ? 'styles.css' : 'app.js'}
                  </button>
                ))}
              </div>

              <div className={`grid grid-cols-1 ${showPreview ? 'xl:grid-cols-2' : ''} gap-4`}>
                <textarea
                  rows={15}
                  value={activeCodeFile === 'html' ? html : activeCodeFile === 'css' ? css : js}
                  onChange={(e) => {
                    if (activeCodeFile === 'html') setHtml(e.target.value);
                    else if (activeCodeFile === 'css') setCss(e.target.value);
                    else setJs(e.target.value);
                  }}
                  className="w-full bg-[#04070D] border border-sky-400/20 rounded-lg p-3 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
                />
                {showPreview && (
                  <iframe
                    title="JARVIS Web Preview"
                    sandbox="allow-scripts"
                    srcDoc={previewDoc}
                    className="w-full h-[332px] bg-white rounded-lg border border-sky-400/20"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 jarvis-glass border border-sky-400/15 rounded-xl p-4 space-y-2 max-h-[540px] overflow-y-auto">
            <p className="text-xs font-semibold text-slate-200 mb-2">
              Native Kotlin &amp; Gradle Source Tree
            </p>
            {androidLoading ? (
              <p className="text-xs text-slate-400">Loading Android project tree...</p>
            ) : (
              androidTree.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => void loadAndroidFile(file.path)}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono truncate ${
                    selectedAndroidPath === file.path
                      ? 'bg-sky-600/30 text-cyan-300'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  {file.path}
                </button>
              ))
            )}
          </div>
          <div className="lg:col-span-8 jarvis-glass border border-sky-400/15 rounded-xl p-4 space-y-2">
            <p className="text-xs font-mono text-cyan-300">{selectedAndroidPath || 'Select a file'}</p>
            <pre className="bg-[#04070D] border border-sky-400/15 rounded-lg p-4 text-xs font-mono text-slate-200 max-h-[480px] overflow-auto">
              {selectedAndroidCode}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

interface RtdbDiagnosticsStatus {
  configured: boolean;
  validFormat: boolean;
  reachable: boolean;
  rulesProtected?: boolean;
  message: string;
}

interface SystemDiagnosticsScreenProps {
  models: ModelInfo[];
  activeModelId: string;
  firestoreStatus: { connected: boolean; message: string };
  rtdbUrl: string;
  rtdbStatus?: RtdbDiagnosticsStatus;
  geminiConfigured?: boolean | null;
  onRefreshDiagnostics: () => Promise<void>;
}

export const SystemDiagnosticsScreen: React.FC<SystemDiagnosticsScreenProps> = ({
  models,
  activeModelId,
  firestoreStatus,
  rtdbUrl,
  rtdbStatus,
  geminiConfigured,
  onRefreshDiagnostics,
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshDiagnostics();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">System &amp; Model Diagnostics</h2>
            <p className="text-xs text-slate-400">
              Live server checks for Gemini model availability, Firebase connectivity, and Realme 6 physical-device requirements.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs text-white font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Run Live Check
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg border border-sky-400/15 bg-[#070E1C] p-4 space-y-1.5">
            <p className="text-slate-400">Active Configurable Model</p>
            <p className="font-mono text-sm text-cyan-300">{activeModelId}</p>
            <p className="text-slate-400">
              {geminiConfigured === false
                ? 'GEMINI_API_KEY is missing from server secrets.'
                : geminiConfigured === true
                  ? 'Server-side GEMINI_API_KEY active; Flash-Lite & deprecated IDs blocked.'
                  : 'Flash-Lite & deprecated IDs blocked via configurable model service.'}
            </p>
          </div>

          <div className="rounded-lg border border-sky-400/15 bg-[#070E1C] p-4 space-y-1.5">
            <p className="text-slate-400">Firebase Firestore (jarvis-7402c)</p>
            <p className={`text-sm font-medium ${firestoreStatus.connected ? 'text-emerald-300' : 'text-amber-300'}`}>
              {firestoreStatus.connected ? 'Connected' : 'Attention Needed'}
            </p>
            <p className="text-slate-400">{firestoreStatus.message}</p>
          </div>

          <div className="rounded-lg border border-sky-400/15 bg-[#070E1C] p-4 space-y-1.5">
            <p className="text-slate-400">Singapore Realtime Database</p>
            <p
              className={`text-sm font-medium ${
                rtdbStatus?.reachable
                  ? 'text-emerald-300'
                  : rtdbUrl
                    ? 'text-cyan-300'
                    : 'text-amber-300'
              }`}
            >
              {rtdbStatus?.reachable
                ? 'Connected'
                : rtdbStatus?.configured
                  ? 'Configured (Needs Check)'
                  : rtdbUrl
                    ? 'Owner Override Configured'
                    : 'Missing FIREBASE_DATABASE_URL'}
            </p>
            <p className="text-slate-400">
              {rtdbStatus?.message || 'Configure FIREBASE_DATABASE_URL in server Secrets or Settings.'}
            </p>
          </div>
        </div>
      </div>

      <div className="jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-3">
        <h3 className="text-base font-semibold text-slate-100">Gemini Model Availability</h3>
        <div className="divide-y divide-sky-400/10 text-xs">
          {models.length === 0 ? (
            <p className="text-slate-400 py-4">Click &ldquo;Run Live Check&rdquo; to inspect Gemini models.</p>
          ) : (
            models.map((m) => (
              <div key={m.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-slate-100">{m.id}</span>
                  <span className="text-slate-400 ml-2">({m.label})</span>
                </div>
                <div className="flex items-center gap-2">
                  {m.isAvailable ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {m.note}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-2 text-xs text-slate-300">
        <h3 className="text-base font-semibold text-slate-100">
          Physical Device Testing Requirements (Realme 6)
        </h3>
        <p>
          This cloud environment builds and verifies the live Web Command Center + Gemini Backend Proxy. Compiling the native Kotlin APK and testing OS-level Android hardware hooks require Android Studio and a physical Realme 6:
        </p>
        <ul className="list-disc list-inside space-y-1 text-slate-400 pt-1">
          <li>Gradle APK build (`cd android && ./gradlew assembleDebug`) requires local JDK 17 + Android SDK 35.</li>
          <li>Accessibility Service UI node tapping, CapCut timeline inspection, and YouTube/Play Store intents require Realme 6 physical device testing.</li>
          <li>MediaProjection single-frame capture and FLAG_SECURE handling require Android OS runtime permission dialogs.</li>
          <li>Contacts (`READ_CONTACTS`), Phone (`CALL_PHONE`), and WorkManager battery exemption require physical Realme UI verification.</li>
        </ul>
      </div>
    </div>
  );
};
