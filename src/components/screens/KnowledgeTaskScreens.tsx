import React, { useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Globe,
  MapPin,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import type {
  MemoryCategory,
  MemoryImportance,
  MemoryRecord,
  SocialSeoResult,
  TaskCategory,
  TaskRecord,
} from '../../types/jarvis';

interface MemoryManagerScreenProps {
  memories: MemoryRecord[];
  isAuthenticated: boolean;
  onSaveMemory: (payload: {
    id?: string;
    category: MemoryCategory;
    title: string;
    content: string;
    importance: MemoryImportance;
    tags: string[];
  }) => Promise<void>;
  onDeleteMemory: (memory: MemoryRecord) => void;
  onClearAllMemories?: () => void;
}

export const MemoryManagerScreen: React.FC<MemoryManagerScreenProps> = ({
  memories,
  isAuthenticated,
  onSaveMemory,
  onDeleteMemory,
  onClearAllMemories,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<MemoryCategory>('instruction');
  const [importance, setImportance] = useState<MemoryImportance>('normal');
  const [tagsText, setTagsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filtered = memories.filter((m) => {
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      await onSaveMemory({
        id: editingId,
        category,
        title: title.trim(),
        content: content.trim(),
        importance,
        tags: tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10),
      });
      setEditingId(undefined);
      setTitle('');
      setContent('');
      setTagsText('');
      setFeedback('Memory saved and verified in Firebase.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to save memory.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (mem: MemoryRecord) => {
    setEditingId(mem.id);
    setTitle(mem.title);
    setContent(mem.content);
    setCategory(mem.category);
    setImportance(mem.importance);
    setTagsText(mem.tags.join(', '));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <form
        onSubmit={handleSave}
        className="lg:col-span-4 jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-4 h-fit"
      >
        <h2 className="text-lg font-semibold text-slate-100">
          {editingId ? 'Update Memory' : 'Save New Memory'}
        </h2>
        {!isAuthenticated && (
          <p className="text-xs text-amber-300">
            Sign in with Google above to persist long-term memories to Firebase.
          </p>
        )}
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Client Website Stack)"
            className="w-full bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-sm text-slate-100"
          />
          <div className="grid grid-cols-2 gap-2.5">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MemoryCategory)}
              className="bg-[#060B14] border border-sky-400/20 rounded-lg px-2.5 py-2 text-xs text-slate-100"
            >
              <option value="instruction">Instruction</option>
              <option value="preference">Preference</option>
              <option value="project">Project Details</option>
              <option value="webdev">Website Dev Info</option>
              <option value="contact_note">Contact Note</option>
              <option value="conversation">Conversation</option>
            </select>
            <select
              value={importance}
              onChange={(e) => setImportance(e.target.value as MemoryImportance)}
              className="bg-[#060B14] border border-sky-400/20 rounded-lg px-2.5 py-2 text-xs text-slate-100"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Important instructions, preferences, or project details..."
            className="w-full bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-sm text-slate-100"
          />
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="Tags (comma-separated)"
            className="w-full bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-xs text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="submit"
            disabled={saving || !isAuthenticated}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-white text-sm font-medium whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            {saving ? 'Saving...' : editingId ? 'Update Memory' : 'Save Memory'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(undefined);
                setTitle('');
                setContent('');
              }}
              className="px-3 py-2 text-xs text-slate-300 hover:text-white"
            >
              Cancel
            </button>
          )}
        </div>
        {feedback && <p className="text-xs text-cyan-300">{feedback}</p>}
      </form>

      <div className="lg:col-span-8 jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-100">
            Searchable Long-Term Memory ({filtered.length})
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search memories..."
                className="w-full bg-[#060B14] border border-sky-400/20 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#060B14] border border-sky-400/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
            >
              <option value="all">All Categories</option>
              <option value="instruction">Instruction</option>
              <option value="preference">Preference</option>
              <option value="project">Project</option>
              <option value="webdev">Web Dev</option>
              <option value="conversation">Conversation</option>
              <option value="contact_note">Contact Note</option>
            </select>
            {memories.length > 0 && onClearAllMemories && (
              <button
                type="button"
                onClick={onClearAllMemories}
                className="px-2.5 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 text-xs text-rose-200 whitespace-nowrap shrink-0"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 py-8">
            No matching memories yet. Add preferences, project notes, or tell JARVIS to remember something.
          </p>
        ) : (
          <div className="divide-y divide-sky-400/10 max-h-[500px] overflow-y-auto pr-1">
            {filtered.map((mem) => (
              <div key={mem.id} className="py-3.5 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="text-cyan-300 font-medium">{mem.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{mem.importance}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{mem.id}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{new Date(mem.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-100">{mem.title}</p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{mem.content}</p>
                  {mem.tags.length > 0 && (
                    <p className="text-xs font-mono text-sky-400">{mem.tags.join(' · ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(mem)}
                    aria-label="Edit memory"
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMemory(mem)}
                    aria-label="Delete memory"
                    className="p-1.5 rounded-md hover:bg-rose-950/60 text-rose-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface TaskManagerScreenProps {
  tasks: TaskRecord[];
  isAuthenticated: boolean;
  onCreateTask: (title: string, category: TaskCategory, description: string) => Promise<void>;
  onRetryTask: (task: TaskRecord) => Promise<void>;
  onCancelTask: (task: TaskRecord) => Promise<void>;
  onCompleteTask: (task: TaskRecord) => Promise<void>;
}

export const TaskManagerScreen: React.FC<TaskManagerScreenProps> = ({
  tasks,
  isAuthenticated,
  onCreateTask,
  onRetryTask,
  onCancelTask,
  onCompleteTask,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('automation');
  const [description, setDescription] = useState('');
  const [filter, setFilter] = useState<'all' | 'unfinished' | 'completed'>('all');

  const unfinished = tasks.filter(
    (t) => t.status === 'queued' || t.status === 'running' || t.status === 'paused' || t.status === 'failed' || t.status === 'awaiting_confirmation'
  );
  const visible =
    filter === 'unfinished'
      ? unfinished
      : filter === 'completed'
        ? tasks.filter((t) => t.status === 'completed')
        : tasks;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onCreateTask(title.trim(), category, description.trim());
    setTitle('');
    setDescription('');
  };

  return (
    <div className="space-y-6">
      <div className="jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Task Queue &amp; Recovery</h2>
            <p className="text-xs text-slate-400">
              Unfinished tasks recover automatically from Firebase after restart ({unfinished.length} pending).
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-[#060B14] rounded-lg border border-sky-400/15">
            {(['all', 'unfinished', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filter === tab ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'all' ? 'All Tasks' : tab === 'unfinished' ? 'Unfinished' : 'Completed'}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New background task title..."
            className="md:col-span-4 bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-sm text-slate-100"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskCategory)}
            className="md:col-span-2 bg-[#060B14] border border-sky-400/20 rounded-lg px-2.5 py-2 text-xs text-slate-100"
          >
            <option value="automation">Automation</option>
            <option value="website">Website</option>
            <option value="research">Research</option>
            <option value="social">Social Media</option>
            <option value="vision">Screen Vision</option>
          </select>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Task details or recovery checkpoint..."
            className="md:col-span-4 bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-sm text-slate-100"
          />
          <button
            type="submit"
            disabled={!isAuthenticated || !title.trim()}
            className="md:col-span-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-white text-sm font-medium whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Queue Task
          </button>
        </form>
      </div>

      <div className="jarvis-glass border border-sky-400/15 rounded-xl p-6">
        {visible.length === 0 ? (
          <p className="text-sm text-slate-400 py-6">No tasks in this view.</p>
        ) : (
          <div className="divide-y divide-sky-400/10">
            {visible.map((task) => (
              <div key={task.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="font-medium text-cyan-300">{task.status}</span>
                    <span aria-hidden="true">·</span>
                    <span>{task.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{task.progress}%</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">Retries: {task.retryCount}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-100">{task.title}</p>
                  {task.description && <p className="text-xs text-slate-300">{task.description}</p>}
                  {task.lastError && <p className="text-xs text-rose-300">{task.lastError}</p>}
                </div>

                {task.status !== 'completed' && task.status !== 'cancelled' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void onCompleteTask(task)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Done
                    </button>
                    <button
                      type="button"
                      onClick={() => void onRetryTask(task)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => void onCancelTask(task)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface PhoneAutomationScreenProps {
  onSendAgentCommand: (prompt: string) => Promise<void>;
  onMapsResearchToWebsite: (query: string) => Promise<{
    summary: string;
    chunks: Array<{ maps?: { uri?: string; title?: string }; web?: { uri?: string; title?: string } }>;
  }>;
  onGenerateWebsiteFromResearch: (businessSummary: string, query: string) => Promise<void>;
  latestSeo: SocialSeoResult | null;
}

export const PhoneAutomationScreen: React.FC<PhoneAutomationScreenProps> = ({
  onSendAgentCommand,
  onMapsResearchToWebsite,
  onGenerateWebsiteFromResearch,
  latestSeo,
}) => {
  const [mapsQuery, setMapsQuery] = useState('Patna restaurants');
  const [researchResult, setResearchResult] = useState<{
    summary: string;
    chunks: Array<{ maps?: { uri?: string; title?: string }; web?: { uri?: string; title?: string } }>;
  } | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);

  const [socialTopic, setSocialTopic] = useState('');
  const [socialPlatform, setSocialPlatform] = useState('YouTube');
  const [contactQuery, setContactQuery] = useState('Ali');

  const handleRunMaps = async () => {
    if (!mapsQuery.trim()) return;
    setResearchLoading(true);
    setResearchError(null);
    try {
      const res = await onMapsResearchToWebsite(mapsQuery.trim());
      setResearchResult(res);
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : 'Business research failed.');
    } finally {
      setResearchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Universal App Control, CapCut, YouTube & Calls */}
        <div className="jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">
            Realme 6 App, Call &amp; CapCut Automation
          </h2>
          <p className="text-xs text-slate-400">
            Plans dynamic Android Intent + AccessibilityNodeInfo sequences for the Realme 6 APK. Sensitive actions always require Mozahid&apos;s confirmation.
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => void onSendAgentCommand('YouTube kholo aur Arijit Singh ka naya song search karo.')}
              className="px-3 py-2 rounded-lg bg-[#070E1C] hover:bg-sky-950/50 border border-sky-400/20 text-xs text-slate-200 text-left"
            >
              YouTube Song Search
            </button>
            <button
              type="button"
              onClick={() => void onSendAgentCommand('CapCut open karo aur timeline mein transition add karne ka step-by-step UI plan banao.')}
              className="px-3 py-2 rounded-lg bg-[#070E1C] hover:bg-sky-950/50 border border-sky-400/20 text-xs text-slate-200 text-left"
            >
              CapCut Guided Edit
            </button>
            <button
              type="button"
              onClick={() => void onSendAgentCommand('Play Store mein BGMI search karne ka safe Android plan do.')}
              className="px-3 py-2 rounded-lg bg-[#070E1C] hover:bg-sky-950/50 border border-sky-400/20 text-xs text-slate-200 text-left"
            >
              Play Store App Search
            </button>
            <button
              type="button"
              onClick={() => void onSendAgentCommand('Chrome aur Settings app control sequence prepare karo.')}
              className="px-3 py-2 rounded-lg bg-[#070E1C] hover:bg-sky-950/50 border border-sky-400/20 text-xs text-slate-200 text-left"
            >
              Universal App Control
            </button>
          </div>

          <div className="pt-3 border-t border-sky-400/10 space-y-2.5">
            <label className="block text-xs text-slate-300">Confirmed Contact &amp; Call Flow</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Contact name..."
                className="flex-1 bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-sm text-slate-100"
              />
              <button
                type="button"
                onClick={() =>
                  void onSendAgentCommand(`JARVIS, ${contactQuery.trim() || 'Ali'} ko call karo. Confirm before dialing.`)
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium whitespace-nowrap shrink-0"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Prepare Call
              </button>
            </div>
          </div>
        </div>

        {/* Universal Social Media SEO & Posting Assistant */}
        <div className="jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Universal Social Media Manager</h2>
          <p className="text-xs text-slate-400">
            Generates titles, descriptions, captions, hashtags, tags, and keywords for YouTube, Instagram, and Facebook. Never publishes without final approval.
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <select
              value={socialPlatform}
              onChange={(e) => setSocialPlatform(e.target.value)}
              className="bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-xs text-slate-100"
            >
              <option value="YouTube">YouTube</option>
              <option value="Instagram">Instagram</option>
              <option value="Facebook">Facebook</option>
            </select>
            <input
              type="text"
              value={socialTopic}
              onChange={(e) => setSocialTopic(e.target.value)}
              placeholder="Video or post topic..."
              className="flex-1 bg-[#060B14] border border-sky-400/20 rounded-lg px-3 py-2 text-sm text-slate-100"
            />
            <button
              type="button"
              onClick={() =>
                void onSendAgentCommand(
                  `Generate SEO metadata using generate_social_seo for ${socialPlatform} about: ${
                    socialTopic.trim() || 'Realme 6 cinematic vlog editing tutorial in Hinglish'
                  }`
                )
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate SEO
            </button>
          </div>

          {latestSeo && (
            <div className="rounded-lg border border-sky-400/20 bg-[#070E1C] p-3.5 space-y-1.5 text-xs">
              <p className="text-cyan-300 font-medium">{latestSeo.platform} Draft</p>
              <p className="text-slate-100 font-medium">{latestSeo.title}</p>
              <p className="text-slate-300">{latestSeo.description}</p>
              <p className="text-sky-300 font-mono">{latestSeo.hashtags.join(' ')}</p>
              <p className="text-slate-400 font-mono">Tags: {latestSeo.tags.join(', ')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Google Maps Client Research -> Website Demo Pipeline */}
      <div className="jarvis-glass border border-sky-400/15 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Google Maps Public Business Research &amp; Website Pipeline
            </h2>
            <p className="text-xs text-slate-400">
              Collects only verified public business info via Google Maps grounding—never invents private or unverified details.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <MapPin className="w-4 h-4 text-cyan-300 absolute left-3 top-2.5" />
            <input
              type="text"
              value={mapsQuery}
              onChange={(e) => setMapsQuery(e.target.value)}
              placeholder="e.g. Patna restaurants"
              className="w-full bg-[#060B14] border border-sky-400/20 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleRunMaps()}
            disabled={researchLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium whitespace-nowrap shrink-0"
          >
            <Globe className="w-4 h-4" />
            {researchLoading ? 'Researching...' : 'Search Public Businesses'}
          </button>
        </div>

        {researchError && <p className="text-xs text-rose-300">{researchError}</p>}

        {researchResult && (
          <div className="rounded-lg border border-sky-400/20 bg-[#070E1C] p-4 space-y-3">
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{researchResult.summary}</p>
            {researchResult.chunks.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-sky-400/10">
                <p className="text-xs text-slate-400 font-medium">Verified Map / Source Links:</p>
                <ul className="space-y-1 text-xs">
                  {researchResult.chunks.map((c, idx) => {
                    const uri = c.maps?.uri || c.web?.uri;
                    const title = c.maps?.title || c.web?.title || uri;
                    if (!uri) return null;
                    return (
                      <li key={idx}>
                        <a
                          href={uri}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-300 hover:underline"
                        >
                          {title}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <button
              type="button"
              onClick={() => void onGenerateWebsiteFromResearch(researchResult.summary, mapsQuery)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 text-xs font-semibold"
            >
              Generate Website Demo in Developer Workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
