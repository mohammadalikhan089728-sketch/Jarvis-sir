export type JarvisScreenId =
  | 'home'
  | 'voice'
  | 'history'
  | 'memory'
  | 'tasks'
  | 'automation'
  | 'permissions'
  | 'settings'
  | 'developer'
  | 'diagnostics';

export type MemoryCategory =
  | 'preference'
  | 'project'
  | 'instruction'
  | 'webdev'
  | 'conversation'
  | 'contact_note';

export type MemoryImportance = 'low' | 'normal' | 'high' | 'critical';

export interface MemoryRecord {
  id: string;
  userId: string;
  category: MemoryCategory;
  title: string;
  content: string;
  tags: string[];
  importance: MemoryImportance;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  userId: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  channel: 'voice' | 'text' | 'vision' | 'automation';
  modelUsed?: string;
  toolSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus =
  | 'queued'
  | 'running'
  | 'awaiting_confirmation'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskCategory =
  | 'automation'
  | 'website'
  | 'research'
  | 'social'
  | 'voice'
  | 'vision'
  | 'system';

export interface TaskRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  progress: number;
  retryCount: number;
  lastError?: string;
  resultSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceProject {
  id: string;
  userId: string;
  name: string;
  stack: string;
  summary: string;
  entryHtml: string;
  entryCss: string;
  entryJs: string;
  sourceNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileSettings {
  userId: string;
  ownerName: string;
  deviceModel: string;
  primaryLanguage: 'Hinglish' | 'English';
  secondaryLanguage: 'English' | 'Hinglish';
  activeModelId: string;
  realtimeDatabaseUrl: string;
  wakeWordEnabled: boolean;
  ttsRate: number;
  confirmSensitiveActions: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelInfo {
  id: string;
  label: string;
  tier: string;
  supportsMultimodal: boolean;
  supportsFunctionCalling: boolean;
  isAvailable: boolean;
  note: string;
}

export interface AutomationPlan {
  domain: string;
  targetApp: string;
  steps: string[];
  requiresConfirmation: boolean;
  confirmationPrompt?: string;
}

export interface SocialSeoResult {
  platform: string;
  title: string;
  description: string;
  caption: string;
  hashtags: string[];
  tags: string[];
  keywords?: string[];
}

export interface PendingConfirmation {
  id: string;
  title: string;
  description: string;
  actionType:
    | 'call'
    | 'publish'
    | 'delete_memory'
    | 'clear_memories'
    | 'clear_conversations'
    | 'overwrite_project'
    | 'install_app'
    | 'automation';
  onConfirm: () => Promise<void> | void;
}
