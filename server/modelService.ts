import { GoogleGenAI } from '@google/genai';

export interface ModelInfo {
  id: string;
  label: string;
  tier: string;
  supportsMultimodal: boolean;
  supportsFunctionCalling: boolean;
  isAvailable: boolean;
  note: string;
}

const PROHIBITED_SUBSTRINGS = ['flash-lite', 'gemini-1.5', 'gemini-2.0', 'gemini-pro'];
const VALID_GEMINI_ID_REGEX = /^gemini-[a-z0-9._-]+$/i;

const CANDIDATE_MODELS: Array<Omit<ModelInfo, 'isAvailable' | 'note'>> = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Flash (Hydrogen)',
    tier: 'Primary Flash',
    supportsMultimodal: true,
    supportsFunctionCalling: true,
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    tier: 'Stable Flash (Catalogue Verified)',
    supportsMultimodal: true,
    supportsFunctionCalling: true,
  },
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Pro (Argon)',
    tier: 'Complex Reasoning / Coding',
    supportsMultimodal: true,
    supportsFunctionCalling: true,
  },
  {
    id: 'gemini-4-carbon',
    label: 'Gemini 4 Deep Reasoning (Carbon)',
    tier: 'Deep Architecture',
    supportsMultimodal: true,
    supportsFunctionCalling: true,
  },
];

let activeModelId: string = validateOrFallback(process.env.JARVIS_GEMINI_MODEL || 'gemini-4-hydrogen');

export function isModelAllowed(modelId: string): boolean {
  const clean = modelId.trim();
  if (!VALID_GEMINI_ID_REGEX.test(clean)) return false;
  const lower = clean.toLowerCase();
  return !PROHIBITED_SUBSTRINGS.some((sub) => lower.includes(sub));
}

export function validateOrFallback(modelId: string): string {
  const clean = modelId.trim();
  if (isModelAllowed(clean)) return clean;
  return 'gemini-4-hydrogen';
}

export function getActiveModelId(): string {
  if (!isModelAllowed(activeModelId)) {
    activeModelId = 'gemini-4-hydrogen';
  }
  return activeModelId;
}

export function setActiveModelId(modelId: string): { ok: boolean; modelId: string; error?: string } {
  const clean = modelId.trim();
  if (!isModelAllowed(clean)) {
    return {
      ok: false,
      modelId: getActiveModelId(),
      error: `Model '${clean.slice(0, 40)}' is invalid or prohibited (Flash-Lite and deprecated Gemini 1.5/2.0/Pro IDs are disabled).`,
    };
  }
  activeModelId = clean;
  return { ok: true, modelId: activeModelId };
}

export function createGenAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing from server environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sanitizeErrorNote(raw: string): string {
  return raw
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_KEY]')
    .replace(/https:\/\/[^\s"']+/g, '[REDACTED_URL]')
    .slice(0, 140);
}

export async function checkModelsAvailability(): Promise<{
  activeModelId: string;
  catalogueChecked: boolean;
  catalogueCount: number;
  catalogueFlashModels: string[];
  models: ModelInfo[];
  apiConfigured: boolean;
}> {
  const apiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const currentActive = getActiveModelId();

  if (!apiConfigured) {
    return {
      activeModelId: currentActive,
      catalogueChecked: false,
      catalogueCount: 0,
      catalogueFlashModels: [],
      apiConfigured: false,
      models: CANDIDATE_MODELS.map((m) => ({
        ...m,
        isAvailable: false,
        note: 'GEMINI_API_KEY missing from server environment',
      })),
    };
  }

  const ai = createGenAiClient();
  let catalogueCount = 0;
  let catalogueChecked = false;
  const catalogueFlashModels: string[] = [];

  try {
    const pager = await ai.models.list({ config: { pageSize: 50 } });
    for await (const m of pager) {
      catalogueCount += 1;
      const name = (m.name || '').replace(/^models\//, '');
      if (name && name.toLowerCase().includes('flash') && !name.toLowerCase().includes('lite')) {
        catalogueFlashModels.push(name);
      }
      if (catalogueCount >= 50) break;
    }
    catalogueChecked = true;
  } catch {
    catalogueChecked = false;
  }

  const checked = await Promise.all(
    CANDIDATE_MODELS.map(async (candidate) => {
      try {
        await ai.models.get({ model: candidate.id });
        return {
          ...candidate,
          isAvailable: true,
          note: 'Verified active on official Gemini catalogue',
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          ...candidate,
          isAvailable: false,
          note: sanitizeErrorNote(msg),
        };
      }
    })
  );

  return {
    activeModelId: currentActive,
    catalogueChecked,
    catalogueCount,
    catalogueFlashModels,
    apiConfigured: true,
    models: checked,
  };
}
