import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDatabase, ref as rtdbRef, set as rtdbSet, remove as rtdbRemove } from 'firebase/database';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  ConversationMessage,
  MemoryRecord,
  TaskRecord,
  UserProfileSettings,
  WorkspaceProject,
} from '../types/jarvis';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<{
  connected: boolean;
  message: string;
}> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { connected: true, message: 'Firestore reachable on jarvis-7402c' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      return { connected: false, message: 'Client is offline. Check Firebase configuration.' };
    }
    // Missing or insufficient permissions on test/connection still confirms server round-trip succeeded.
    if (msg.includes('Missing or insufficient permissions') || msg.includes('permission-denied')) {
      return { connected: true, message: 'Firestore server connected (rules active).' };
    }
    return { connected: false, message: msg };
  }
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutOwner(): Promise<void> {
  await signOut(auth);
}

export function makeSafeId(prefix: string): string {
  const raw = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function clampString(val: string | undefined, max: number): string {
  return (val || '').trim().slice(0, max);
}

export function containsSensitiveSecret(text: string): boolean {
  return /AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z]{20,}|-----BEGIN PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._-]{25,}/i.test(
    text
  );
}

function redactSensitiveSecrets(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_KEY]')
    .replace(/sk-[0-9A-Za-z]{20,}/g, '[REDACTED_KEY]')
    .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]');
}

async function mirrorToRtdb(
  rtdbUrl: string | undefined,
  uid: string,
  subpath: 'profile' | 'memory' | 'conversations' | 'preferences' | 'tasks' | 'activity' | 'projects',
  recordId: string | null,
  payload: Record<string, unknown> | null
): Promise<void> {
  if (rtdbUrl && rtdbUrl.startsWith('https://')) {
    try {
      const rtdb = getDatabase(app, rtdbUrl);
      const path = recordId ? `users/${uid}/${subpath}/${recordId}` : `users/${uid}/${subpath}`;
      const targetRef = rtdbRef(rtdb, path);
      if (payload === null) {
        await rtdbRemove(targetRef);
      } else {
        await rtdbSet(targetRef, payload);
      }
      return;
    } catch {
      // Fallback to server-side RTDB proxy if configured in server environment
    }
  }

  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const querySuffix = recordId ? `?id=${encodeURIComponent(recordId)}` : '';
    await fetch(`/api/jarvis/rtdb/user/${encodeURIComponent(uid)}/${subpath}${querySuffix}`, {
      method: payload === null ? 'DELETE' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: payload === null ? undefined : JSON.stringify(payload),
    });
  } catch {
    // RTDB mirror is non-blocking when FIREBASE_DATABASE_URL is not configured yet.
  }
}

export async function ensureUserProfile(
  uid: string,
  defaults: Partial<UserProfileSettings>
): Promise<UserProfileSettings> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        userId: uid,
        ownerName: String(data.ownerName || 'Mozahid'),
        deviceModel: String(data.deviceModel || 'Realme 6'),
        primaryLanguage: data.primaryLanguage === 'English' ? 'English' : 'Hinglish',
        secondaryLanguage: data.secondaryLanguage === 'Hinglish' ? 'Hinglish' : 'English',
        activeModelId: String(data.activeModelId || 'gemini-4-hydrogen'),
        realtimeDatabaseUrl: String(data.realtimeDatabaseUrl || ''),
        wakeWordEnabled: Boolean(data.wakeWordEnabled),
        ttsRate: typeof data.ttsRate === 'number' ? data.ttsRate : 1.0,
        confirmSensitiveActions: data.confirmSensitiveActions !== false,
        createdAt: toIsoString(data.createdAt),
        updatedAt: toIsoString(data.updatedAt),
      };
    }

    const primaryLang: 'Hinglish' | 'English' =
      defaults.primaryLanguage === 'English' ? 'English' : 'Hinglish';
    const secondaryLang: 'English' | 'Hinglish' =
      defaults.secondaryLanguage === 'Hinglish' ? 'Hinglish' : 'English';

    const payload = {
      userId: uid,
      ownerName: clampString(defaults.ownerName || 'Mozahid', 80),
      deviceModel: clampString(defaults.deviceModel || 'Realme 6', 80),
      primaryLanguage: primaryLang,
      secondaryLanguage: secondaryLang,
      activeModelId: clampString(defaults.activeModelId || 'gemini-4-hydrogen', 100),
      realtimeDatabaseUrl: clampString(defaults.realtimeDatabaseUrl || '', 300),
      wakeWordEnabled: Boolean(defaults.wakeWordEnabled),
      ttsRate: 1.0,
      confirmSensitiveActions: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, payload);
    const nowIso = new Date().toISOString();
    return {
      userId: uid,
      ownerName: payload.ownerName,
      deviceModel: payload.deviceModel,
      primaryLanguage: payload.primaryLanguage,
      secondaryLanguage: payload.secondaryLanguage,
      activeModelId: payload.activeModelId,
      realtimeDatabaseUrl: payload.realtimeDatabaseUrl,
      wakeWordEnabled: payload.wakeWordEnabled,
      ttsRate: payload.ttsRate,
      confirmSensitiveActions: payload.confirmSensitiveActions,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfileSettings>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.ownerName !== undefined) clean.ownerName = clampString(updates.ownerName, 80);
    if (updates.deviceModel !== undefined) clean.deviceModel = clampString(updates.deviceModel, 80);
    if (updates.primaryLanguage !== undefined) clean.primaryLanguage = updates.primaryLanguage;
    if (updates.secondaryLanguage !== undefined) clean.secondaryLanguage = updates.secondaryLanguage;
    if (updates.activeModelId !== undefined) clean.activeModelId = clampString(updates.activeModelId, 100);
    if (updates.realtimeDatabaseUrl !== undefined) {
      clean.realtimeDatabaseUrl = clampString(updates.realtimeDatabaseUrl, 300);
    }
    if (updates.wakeWordEnabled !== undefined) clean.wakeWordEnabled = Boolean(updates.wakeWordEnabled);
    if (updates.ttsRate !== undefined) {
      clean.ttsRate = Math.min(2.0, Math.max(0.5, Number(updates.ttsRate) || 1.0));
    }
    if (updates.confirmSensitiveActions !== undefined) {
      clean.confirmSensitiveActions = Boolean(updates.confirmSensitiveActions);
    }
    await updateDoc(doc(db, 'users', uid), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeMemories(
  uid: string,
  onData: (items: MemoryRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/memories`;
  const q = query(
    collection(db, 'users', uid, 'memories'),
    where('userId', '==', uid),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: MemoryRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          userId: String(data.userId || uid),
          category: data.category || 'instruction',
          title: String(data.title || ''),
          content: String(data.content || ''),
          tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
          importance: data.importance || 'normal',
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        };
      });
      onData(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveMemoryRecord(
  uid: string,
  input: Omit<MemoryRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string },
  rtdbUrl?: string
): Promise<string> {
  if (containsSensitiveSecret(`${input.title} ${input.content}`)) {
    throw new Error('Refusing to persist API keys or private credentials in long-term memory.');
  }
  const id = input.id ? clampString(input.id, 128) : makeSafeId('mem');
  const path = `users/${uid}/memories/${id}`;
  const cleanTags = (input.tags || [])
    .map((t) => clampString(t, 40))
    .filter(Boolean)
    .slice(0, 10);

  try {
    if (input.id) {
      await updateDoc(doc(db, 'users', uid, 'memories', id), {
        category: input.category,
        title: clampString(input.title, 200) || 'Untitled Memory',
        content: clampString(input.content, 8000) || '-',
        tags: cleanTags,
        importance: input.importance,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'users', uid, 'memories', id), {
        id,
        userId: uid,
        category: input.category,
        title: clampString(input.title, 200) || 'Untitled Memory',
        content: clampString(input.content, 8000) || '-',
        tags: cleanTags,
        importance: input.importance,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await mirrorToRtdb(rtdbUrl, uid, 'memory', id, {
      id,
      category: input.category,
      title: clampString(input.title, 200),
      content: clampString(input.content, 8000),
      tags: cleanTags,
      importance: input.importance,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, input.id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteMemoryRecord(uid: string, memoryId: string, rtdbUrl?: string): Promise<void> {
  const path = `users/${uid}/memories/${memoryId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'memories', memoryId));
    await mirrorToRtdb(rtdbUrl, uid, 'memory', memoryId, null);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearUserMemories(uid: string, rtdbUrl?: string): Promise<void> {
  const path = `users/${uid}/memories`;
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'memories'));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    await mirrorToRtdb(rtdbUrl, uid, 'memory', null, null);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeConversations(
  uid: string,
  onData: (items: ConversationMessage[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/conversations`;
  const q = query(
    collection(db, 'users', uid, 'conversations'),
    where('userId', '==', uid),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: ConversationMessage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          userId: String(data.userId || uid),
          sessionId: String(data.sessionId || 'default'),
          role: data.role || 'user',
          content: String(data.content || ''),
          channel: data.channel || 'text',
          modelUsed: data.modelUsed ? String(data.modelUsed) : undefined,
          toolSummary: data.toolSummary ? String(data.toolSummary) : undefined,
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        };
      });
      onData(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveConversationMessage(
  uid: string,
  input: Omit<ConversationMessage, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  rtdbUrl?: string
): Promise<string> {
  const id = makeSafeId('msg');
  const path = `users/${uid}/conversations/${id}`;
  try {
    const safeContent = clampString(redactSensitiveSecrets(input.content), 16000) || '-';
    const payload: Record<string, unknown> = {
      id,
      userId: uid,
      sessionId: clampString(input.sessionId || 'default', 128),
      role: input.role,
      content: safeContent,
      channel: input.channel,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.modelUsed) payload.modelUsed = clampString(input.modelUsed, 100);
    if (input.toolSummary) payload.toolSummary = clampString(input.toolSummary, 2000);

    await setDoc(doc(db, 'users', uid, 'conversations', id), payload);
    await mirrorToRtdb(rtdbUrl, uid, 'conversations', id, {
      id,
      sessionId: payload.sessionId,
      role: input.role,
      content: safeContent,
      channel: input.channel,
      createdAt: Date.now(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function clearUserConversations(uid: string, rtdbUrl?: string): Promise<void> {
  const path = `users/${uid}/conversations`;
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'conversations'));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    await mirrorToRtdb(rtdbUrl, uid, 'conversations', null, null);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeTasks(
  uid: string,
  onData: (items: TaskRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/tasks`;
  const q = query(
    collection(db, 'users', uid, 'tasks'),
    where('userId', '==', uid),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: TaskRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          userId: String(data.userId || uid),
          title: String(data.title || ''),
          description: String(data.description || ''),
          category: data.category || 'automation',
          status: data.status || 'queued',
          progress: Number(data.progress || 0),
          retryCount: Number(data.retryCount || 0),
          lastError: data.lastError ? String(data.lastError) : undefined,
          resultSummary: data.resultSummary ? String(data.resultSummary) : undefined,
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        };
      });
      onData(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createTaskRecord(
  uid: string,
  input: Pick<TaskRecord, 'title' | 'description' | 'category' | 'status' | 'progress'> & {
    resultSummary?: string;
  },
  rtdbUrl?: string
): Promise<string> {
  const id = makeSafeId('task');
  const path = `users/${uid}/tasks/${id}`;
  try {
    const payload: Record<string, unknown> = {
      id,
      userId: uid,
      title: clampString(input.title, 200) || 'JARVIS Task',
      description: clampString(input.description, 4000),
      category: input.category,
      status: input.status,
      progress: Math.min(100, Math.max(0, Math.round(input.progress))),
      retryCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.resultSummary) payload.resultSummary = clampString(input.resultSummary, 4000);
    await setDoc(doc(db, 'users', uid, 'tasks', id), payload);
    await mirrorToRtdb(rtdbUrl, uid, 'tasks', id, {
      id,
      title: payload.title,
      category: input.category,
      status: input.status,
      progress: payload.progress,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTaskRecord(
  uid: string,
  taskId: string,
  updates: {
    status: TaskRecord['status'];
    progress: number;
    retryCount?: number;
    lastError?: string;
    resultSummary?: string;
  }
): Promise<void> {
  const path = `users/${uid}/tasks/${taskId}`;
  try {
    const payload: Record<string, unknown> = {
      status: updates.status,
      progress: Math.min(100, Math.max(0, Math.round(updates.progress))),
      updatedAt: serverTimestamp(),
    };
    if (updates.retryCount !== undefined) payload.retryCount = updates.retryCount;
    if (updates.lastError !== undefined) payload.lastError = clampString(updates.lastError, 1000);
    if (updates.resultSummary !== undefined) payload.resultSummary = clampString(updates.resultSummary, 4000);
    await updateDoc(doc(db, 'users', uid, 'tasks', taskId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeProjects(
  uid: string,
  onData: (items: WorkspaceProject[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/projects`;
  const q = query(
    collection(db, 'users', uid, 'projects'),
    where('userId', '==', uid),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: WorkspaceProject[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          userId: String(data.userId || uid),
          name: String(data.name || ''),
          stack: String(data.stack || 'HTML/CSS/JS'),
          summary: String(data.summary || ''),
          entryHtml: String(data.entryHtml || ''),
          entryCss: String(data.entryCss || ''),
          entryJs: String(data.entryJs || ''),
          sourceNotes: data.sourceNotes ? String(data.sourceNotes) : undefined,
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        };
      });
      onData(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveWorkspaceProject(
  uid: string,
  project: Omit<WorkspaceProject, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string },
  rtdbUrl?: string
): Promise<string> {
  const id = project.id ? clampString(project.id, 128) : makeSafeId('proj');
  const path = `users/${uid}/projects/${id}`;
  try {
    if (project.id) {
      await updateDoc(doc(db, 'users', uid, 'projects', id), {
        name: clampString(project.name, 160),
        stack: clampString(project.stack, 80),
        summary: clampString(project.summary, 2000),
        entryHtml: clampString(project.entryHtml, 60000),
        entryCss: clampString(project.entryCss, 30000),
        entryJs: clampString(project.entryJs, 40000),
        sourceNotes: clampString(project.sourceNotes || '', 8000),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'users', uid, 'projects', id), {
        id,
        userId: uid,
        name: clampString(project.name, 160) || 'Untitled Project',
        stack: clampString(project.stack, 80) || 'HTML/CSS/JS',
        summary: clampString(project.summary, 2000),
        entryHtml: clampString(project.entryHtml, 60000),
        entryCss: clampString(project.entryCss, 30000),
        entryJs: clampString(project.entryJs, 40000),
        sourceNotes: clampString(project.sourceNotes || '', 8000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await mirrorToRtdb(rtdbUrl, uid, 'projects', id, {
      id,
      name: clampString(project.name, 160),
      stack: clampString(project.stack, 80),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, project.id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}
