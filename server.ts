import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { ThinkingLevel, Type, type FunctionDeclaration, type Content } from '@google/genai';
import {
  checkModelsAvailability,
  createGenAiClient,
  getActiveModelId,
  isModelAllowed,
  setActiveModelId,
} from './server/modelService.ts';

const app = express();
const PORT = 3000;
const ANDROID_ROOT = path.resolve(process.cwd(), 'android');

app.use(express.json({ limit: '15mb' }));

const JARVIS_SYSTEM_INSTRUCTION = `You are JARVIS, a calm, intelligent, confident, and helpful personal AI operating assistant built exclusively for your owner, Mozahid (who primarily uses a Realme 6 Android phone).

Identity & Language Rules:
1. Address your owner naturally as "Mozahid".
2. Converse fluently in Hinglish (natural mix of Hindi and English in Latin script) and English, matching Mozahid's tone.
   Example:
   Owner: "Hey Jarvis." -> "Yes Mozahid, I'm listening. How can I help you?"
   Owner: "YouTube kholo." -> "Opening YouTube now, Mozahid." (when Android device tool executes or plans it).
3. Honesty & Grounding:
   - Never claim to have remembered something unless the save_memory_record tool was invoked and queued/saved.
   - Never claim an Android phone action (like opening an app, tapping a button, or placing a call) already executed on the physical phone when running from the Web Command Center — clearly state when an action plan is prepared for the Realme 6 Android app vs executed directly.
   - Never place calls, delete memories, overwrite project files, or publish social posts without explicit confirmation.
   - Never invent business details or claim guaranteed YouTube/social media views or rankings.
   - When analyzing a single image or captured screen frame, never claim to have watched an entire video.`;

const agentTools: FunctionDeclaration[] = [
  {
    name: 'save_memory_record',
    description:
      'Queue a structured long-term memory record to be persisted in Mozahid’s Firebase database (preferences, project details, instructions, website dev notes).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          description: 'One of: preference, project, instruction, webdev, conversation, contact_note',
        },
        title: { type: Type.STRING, description: 'Short descriptive memory title' },
        content: { type: Type.STRING, description: 'Full factual memory content to store' },
        importance: { type: Type.STRING, description: 'One of: low, normal, high, critical' },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Up to 6 short keywords',
        },
      },
      required: ['category', 'title', 'content', 'importance'],
    },
  },
  {
    name: 'create_background_task',
    description: 'Create a persistent background/queue task for JARVIS (e.g., website generation, research, automation).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Task title' },
        category: {
          type: Type.STRING,
          description: 'One of: automation, website, research, social, voice, vision, system',
        },
        description: { type: Type.STRING, description: 'Detailed task steps or goals' },
      },
      required: ['title', 'category', 'description'],
    },
  },
  {
    name: 'plan_phone_automation',
    description:
      'Plan a safe Android Realme 6 automation workflow (opening apps via Intent, Accessibility UI steps, YouTube search, CapCut editing guidance, Call/Contact lookup, or Social Media posting). Always set requiresConfirmation=true for calls, messages, installs, or publishing.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        domain: {
          type: Type.STRING,
          description: 'One of: app_launch, call_contact, youtube_music, capcut_edit, social_media, accessibility_ui',
        },
        targetApp: { type: Type.STRING, description: 'Target Android app name or package' },
        steps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Ordered step-by-step instructions or Accessibility node targets',
        },
        requiresConfirmation: { type: Type.BOOLEAN, description: 'True if sensitive action needs Mozahid confirmation' },
        confirmationPrompt: { type: Type.STRING, description: 'Question to confirm with Mozahid if required' },
      },
      required: ['domain', 'targetApp', 'steps', 'requiresConfirmation'],
    },
  },
  {
    name: 'generate_website_project',
    description: 'Generate a complete responsive multi-file web project (HTML, CSS, JS) for the Developer Workspace.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Project slug or name' },
        stack: { type: Type.STRING, description: 'Tech stack label, e.g. HTML/CSS/JS' },
        summary: { type: Type.STRING, description: 'What the website builds' },
        entryHtml: { type: Type.STRING, description: 'Complete index.html markup' },
        entryCss: { type: Type.STRING, description: 'Complete styles.css stylesheet' },
        entryJs: { type: Type.STRING, description: 'Complete app.js script' },
      },
      required: ['name', 'stack', 'summary', 'entryHtml', 'entryCss', 'entryJs'],
    },
  },
  {
    name: 'generate_social_seo',
    description:
      'Generate multi-platform social media metadata (YouTube, Instagram, Facebook) including titles, descriptions, captions, hashtags, tags, and keywords without claiming guaranteed views.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        platform: { type: Type.STRING, description: 'YouTube, Instagram, Facebook, or Multi-Platform' },
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        caption: { type: Type.STRING },
        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['platform', 'title', 'description', 'caption', 'hashtags', 'tags'],
    },
  },
];

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 45000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Request to Gemini API timed out.')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

async function withBackoff<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await withTimeout(fn(), 45000);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const transient = msg.includes('503') || msg.includes('UNAVAILABLE');
      if (!transient || i === retries) throw err;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastError;
}

function sanitizeSecretText(input: string): string {
  return input
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_KEY]')
    .replace(/sk-[0-9A-Za-z]{20,}/g, '[REDACTED_KEY]')
    .replace(/https:\/\/[^\s"']*(firebaseio\.com|firebasedatabase\.app)[^\s"']*/gi, '[REDACTED_DATABASE_URL]')
    .replace(/auth=[^&\s"']+/gi, 'auth=[REDACTED_TOKEN]');
}

function formatApiError(err: unknown): { status: number; error: string } {
  const raw = sanitizeSecretText(err instanceof Error ? err.message : String(err));
  if (raw.includes('GEMINI_API_KEY')) {
    return { status: 500, error: 'GEMINI_API_KEY is missing from environment secrets.' };
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return { status: 403, error: 'Gemini API authentication failed. Verify GEMINI_API_KEY in Secrets.' };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return { status: 429, error: 'Gemini API quota/rate limit reached. Wait briefly or check billing tier.' };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return { status: 404, error: `Selected model was not found on Gemini API.` };
  }
  return { status: 500, error: raw };
}

function getConfiguredRtdbBaseUrl(): string | null {
  const raw = (process.env.FIREBASE_DATABASE_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function containsSensitiveSecret(text: string): boolean {
  return /AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z]{20,}|-----BEGIN PRIVATE KEY-----/.test(text);
}

function walkDirectory(dir: string, baseDir: string): Array<{ path: string; size: number }> {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: Array<{ path: string; size: number }> = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDirectory(full, baseDir));
    } else {
      const stat = fs.statSync(full);
      results.push({ path: path.relative(baseDir, full).replace(/\\/g, '/'), size: stat.size });
    }
  }
  return results;
}

app.get('/api/jarvis/health', (_req, res) => {
  const androidFiles = walkDirectory(ANDROID_ROOT, ANDROID_ROOT);
  const rtdbBase = getConfiguredRtdbBaseUrl();
  res.json({
    ok: true,
    assistant: 'JARVIS',
    owner: 'Mozahid',
    activeModelId: getActiveModelId(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    firebaseDatabaseUrlConfigured: Boolean(process.env.FIREBASE_DATABASE_URL?.trim()),
    firebaseDatabaseUrlValid: Boolean(rtdbBase),
    androidFileCount: androidFiles.length,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/jarvis/rtdb/status', async (_req, res) => {
  const rawPresent = Boolean(process.env.FIREBASE_DATABASE_URL?.trim());
  if (!rawPresent) {
    res.json({
      configured: false,
      validFormat: false,
      reachable: false,
      message: 'FIREBASE_DATABASE_URL is missing from environment secrets.',
    });
    return;
  }

  const rtdbBase = getConfiguredRtdbBaseUrl();
  if (!rtdbBase) {
    res.json({
      configured: true,
      validFormat: false,
      reachable: false,
      message: 'FIREBASE_DATABASE_URL is not a valid HTTPS Firebase Realtime Database URL.',
    });
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const probe = await fetch(`${rtdbBase}/.json?shallow=true`, { signal: controller.signal });
    clearTimeout(timer);
    // 200 or 401 (permission denied because rules are secured) both prove the RTDB host is reachable!
    const reachable = probe.status === 200 || probe.status === 401;
    res.json({
      configured: true,
      validFormat: true,
      reachable,
      rulesProtected: probe.status === 401,
      message:
        probe.status === 401
          ? 'Singapore Realtime Database reachable and protected by auth rules.'
          : probe.status === 200
            ? 'Realtime Database reachable (warning: verify rules are not public read).'
            : `Realtime Database responded with HTTP ${probe.status}.`,
    });
  } catch {
    res.json({
      configured: true,
      validFormat: true,
      reachable: false,
      message: 'Could not reach Firebase Realtime Database endpoint.',
    });
  }
});

const ALLOWED_RTDB_SECTIONS = new Set([
  'profile',
  'memory',
  'conversations',
  'preferences',
  'tasks',
  'activity',
  'projects',
]);

app.all('/api/jarvis/rtdb/user/:uid/:section', async (req, res) => {
  const rtdbBase = getConfiguredRtdbBaseUrl();
  if (!rtdbBase) {
    res.status(503).json({ error: 'FIREBASE_DATABASE_URL is missing from server secrets.' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!idToken) {
    res.status(401).json({ error: 'Firebase Authentication Bearer token required.' });
    return;
  }

  const uid = String(req.params.uid || '').trim();
  const section = String(req.params.section || '').trim();
  const recordId = req.query.id ? String(req.query.id).trim() : '';
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid) || !ALLOWED_RTDB_SECTIONS.has(section)) {
    res.status(400).json({ error: 'Invalid user ID or database section.' });
    return;
  }
  if (recordId && !/^[a-zA-Z0-9_-]{1,128}$/.test(recordId)) {
    res.status(400).json({ error: 'Invalid record ID.' });
    return;
  }

  const targetPath = recordId
    ? `users/${uid}/${section}/${recordId}.json`
    : `users/${uid}/${section}.json`;
  const targetUrl = `${rtdbBase}/${targetPath}?auth=${encodeURIComponent(idToken)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const method = req.method.toUpperCase();
    const upstream = await fetch(targetUrl, {
      method: method === 'POST' ? 'PUT' : method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(req.body ?? {}),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await upstream.text();
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `RTDB operation rejected (${upstream.status}).` });
      return;
    }
    res.status(200).json(text ? JSON.parse(text) : null);
  } catch {
    res.status(502).json({ error: 'Failed to communicate with Firebase Realtime Database.' });
  }
});

app.get('/api/jarvis/models', async (_req, res) => {
  try {
    const result = await checkModelsAvailability();
    res.json(result);
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.error });
  }
});

app.post('/api/jarvis/config', (req, res) => {
  const requestedModel = String(req.body?.modelId || '');
  if (!requestedModel) {
    res.status(400).json({ error: 'modelId is required.' });
    return;
  }
  const update = setActiveModelId(requestedModel);
  if (!update.ok) {
    res.status(400).json({ error: update.error, activeModelId: update.modelId });
    return;
  }
  res.json({ ok: true, activeModelId: update.modelId });
});

app.post('/api/jarvis/agent', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      res.status(400).json({ error: 'Message cannot be empty.' });
      return;
    }

    const requestedModel = String(req.body?.modelId || getActiveModelId()).trim();
    if (!isModelAllowed(requestedModel)) {
      res.status(400).json({
        error: `Model '${requestedModel}' is prohibited. Flash-Lite and deprecated model IDs cannot be used.`,
      });
      return;
    }

    const historyInput = Array.isArray(req.body?.history) ? req.body.history : [];
    const memoriesInput = Array.isArray(req.body?.memories) ? req.body.memories : [];
    const deviceContext = req.body?.deviceContext || {};

    const memoryContext =
      memoriesInput.length > 0
        ? `\n\nOwner Long-Term Memories:\n${memoriesInput.slice(0, 12).map((m: unknown) => `- ${String(m)}`).join('\n')}`
        : '';

    const contextHeader = `\n\nRuntime Context: Device=${deviceContext.deviceModel || 'Realme 6'}, PrimaryLanguage=${deviceContext.primaryLanguage || 'Hinglish'}, Channel=${deviceContext.channel || 'web'}${deviceContext.screenSummary ? `, ScreenSummary=${deviceContext.screenSummary}` : ''}`;

    const contents: Content[] = [];
    for (const item of historyInput.slice(-10)) {
      const role = item?.role === 'assistant' ? 'model' : 'user';
      const contentText = String(item?.content || '').trim();
      if (contentText) {
        contents.push({ role, parts: [{ text: contentText }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const ai = createGenAiClient();
    const executedTools: Array<{ name: string; args: Record<string, unknown> }> = [];
    const memoryActions: Array<Record<string, unknown>> = [];
    const taskActions: Array<Record<string, unknown>> = [];
    let automationPlan: Record<string, unknown> | null = null;
    let generatedProject: Record<string, unknown> | null = null;
    let socialSeo: Record<string, unknown> | null = null;
    let pendingConfirmation: { title: string; action: string } | null = null;

    let finalReply = '';

    for (let step = 0; step < 4; step++) {
      const response = await withBackoff(() =>
        ai.models.generateContent({
          model: requestedModel,
          contents,
          config: {
            systemInstruction: JARVIS_SYSTEM_INSTRUCTION + contextHeader + memoryContext,
            tools: [{ functionDeclarations: agentTools }],
            thinkingConfig: {
              thinkingLevel:
                requestedModel === 'gemini-4-hydrogen' ? ThinkingLevel.LOW : ThinkingLevel.MEDIUM,
            },
          },
        })
      );

      const calls = response.functionCalls;
      const modelContent = response.candidates?.[0]?.content;

      if (!calls || calls.length === 0) {
        finalReply = response.text?.trim() || '';
        break;
      }

      if (modelContent) {
        contents.push(modelContent);
      }

      const functionResponses = calls.map((call) => {
        const name = call.name || 'unknown';
        const args = (call.args || {}) as Record<string, unknown>;
        executedTools.push({ name, args });

        let toolResult: Record<string, unknown> = { status: 'queued' };

        if (name === 'save_memory_record') {
          const titleStr = String(args.title || '');
          const contentStr = String(args.content || '');
          if (containsSensitiveSecret(titleStr) || containsSensitiveSecret(contentStr)) {
            toolResult = {
              status: 'rejected_sensitive_data',
              note: 'Refused to save potential secret/API key/token into long-term memory.',
            };
          } else {
            memoryActions.push(args);
            toolResult = {
              status: 'dispatched_to_client_firebase',
              note: 'Memory payload sent to client Firebase persistence layer for write verification.',
            };
          }
        } else if (name === 'create_background_task') {
          taskActions.push(args);
          toolResult = { status: 'queued_in_task_manager', title: args.title };
        } else if (name === 'plan_phone_automation') {
          automationPlan = args;
          if (args.requiresConfirmation) {
            pendingConfirmation = {
              title: String(args.targetApp || 'Confirm Action'),
              action: String(args.confirmationPrompt || 'Confirm this sensitive Android action before proceeding.'),
            };
          }
          toolResult = {
            status: args.requiresConfirmation ? 'awaiting_owner_confirmation' : 'automation_plan_ready',
            domain: args.domain,
          };
        } else if (name === 'generate_website_project') {
          generatedProject = args;
          toolResult = { status: 'project_generated', name: args.name };
        } else if (name === 'generate_social_seo') {
          socialSeo = args;
          toolResult = { status: 'seo_generated', platform: args.platform };
        }

        return {
          functionResponse: {
            id: call.id,
            name,
            response: toolResult,
          },
        };
      });

      contents.push({
        role: 'user',
        parts: functionResponses,
      });
    }

    res.json({
      reply: finalReply || 'Understood Mozahid. I have prepared the structured action output.',
      modelUsed: requestedModel,
      executedTools,
      memoryActions,
      taskActions,
      automationPlan,
      generatedProject,
      socialSeo,
      pendingConfirmation,
    });
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.error });
  }
});

app.post('/api/jarvis/vision', async (req, res) => {
  try {
    const imageBase64 = String(req.body?.imageBase64 || '').trim();
    const mimeType = String(req.body?.mimeType || 'image/jpeg').trim();
    const question = String(req.body?.question || 'Analyze this visible frame clearly for Mozahid.').trim();
    const factCheck = Boolean(req.body?.factCheck);
    const modelId = String(req.body?.modelId || getActiveModelId()).trim();

    if (!imageBase64) {
      res.status(400).json({ error: 'imageBase64 payload is required.' });
      return;
    }
    if (!isModelAllowed(modelId)) {
      res.status(400).json({ error: `Model '${modelId}' is not permitted.` });
      return;
    }

    const ai = createGenAiClient();
    const response = await withBackoff(() =>
      ai.models.generateContent({
        model: modelId,
        contents: {
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            {
              text: `${question}\n\nImportant: Describe only what is visible in this captured frame/image. Extract visible text, objects, and educational explanations accurately. If this is a frame from a video, explicitly note that only this captured frame was analyzed (not the entire video).`,
            },
          ],
        },
        config: {
          systemInstruction: JARVIS_SYSTEM_INSTRUCTION,
          ...(factCheck ? { tools: [{ googleSearch: {} }] } : {}),
        },
      })
    );

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    res.json({
      analysis: response.text || 'No analysis returned.',
      modelUsed: modelId,
      sources: groundingChunks,
    });
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.error });
  }
});

app.post('/api/jarvis/research', async (req, res) => {
  try {
    const query = String(req.body?.query || '').trim();
    const mode = req.body?.mode === 'search' ? 'search' : 'maps';
    const modelId = String(req.body?.modelId || getActiveModelId()).trim();
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);

    if (!query) {
      res.status(400).json({ error: 'Research query is required.' });
      return;
    }
    if (!isModelAllowed(modelId)) {
      res.status(400).json({ error: `Model '${modelId}' is not permitted.` });
      return;
    }

    const ai = createGenAiClient();
    const useMaps = mode === 'maps';
    const response = await withBackoff(() =>
      ai.models.generateContent({
        model: modelId,
        contents: `Research publicly available information for Mozahid: ${query}. Only include verified public details retrieved via grounding. Never invent business phone numbers, addresses, ratings, or private information.`,
        config: {
          systemInstruction: JARVIS_SYSTEM_INSTRUCTION,
          tools: useMaps ? [{ googleMaps: {} }] : [{ googleSearch: {} }],
          ...(useMaps && Number.isFinite(lat) && Number.isFinite(lng)
            ? { toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } } }
            : {}),
        },
      })
    );

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    res.json({
      summary: response.text || 'No verified public details found.',
      modelUsed: modelId,
      groundingChunks,
    });
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.error });
  }
});

app.post('/api/jarvis/transcribe', async (req, res) => {
  try {
    const audioBase64 = String(req.body?.audioBase64 || '').trim();
    const mimeType = String(req.body?.mimeType || 'audio/webm').trim();
    if (!audioBase64) {
      res.status(400).json({ error: 'audioBase64 is required.' });
      return;
    }

    const modelId = getActiveModelId();
    const ai = createGenAiClient();
    const response = await withBackoff(() =>
      ai.models.generateContent({
        model: modelId,
        contents: {
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            { text: 'Transcribe this Hinglish or English audio accurately without adding words.' },
          ],
        },
      })
    );

    res.json({
      transcript: response.text?.trim() || '',
      modelUsed: modelId,
    });
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.error });
  }
});

app.get('/api/android/tree', (_req, res) => {
  const files = walkDirectory(ANDROID_ROOT, ANDROID_ROOT).sort((a, b) => a.path.localeCompare(b.path));
  res.json({ root: 'android', files });
});

app.get('/api/android/file', (req, res) => {
  const rel = String(req.query?.path || '').replace(/^\/+/, '');
  const resolved = path.resolve(ANDROID_ROOT, rel);
  if (!resolved.startsWith(ANDROID_ROOT) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    res.status(404).json({ error: 'Android source file not found.' });
    return;
  }
  const content = fs.readFileSync(resolved, 'utf8');
  res.json({ path: rel, content });
});

app.get('/api/android/download', async (_req, res) => {
  try {
    const zip = new JSZip();
    const files = walkDirectory(ANDROID_ROOT, ANDROID_ROOT);
    for (const file of files) {
      const fullPath = path.join(ANDROID_ROOT, file.path);
      zip.file(`jarvis-android/${file.path}`, fs.readFileSync(fullPath));
    }
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="jarvis-android-project.zip"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to package Android ZIP' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JARVIS Command Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
