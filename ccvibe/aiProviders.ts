/*
 * CCVibe - OpenAI-compatible AI provider configs
 */

export type AiProviderId = "groq" | "deepseek" | "openrouter" | "openai" | "custom";

export interface AiProviderDefinition {
    id: AiProviderId;
    label: string;
    baseUrl: string;
    defaultModel: string;
    keyHint: string;
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderDefinition> = {
    groq: {
        id: "groq",
        label: "Groq",
        baseUrl: "https://api.groq.com/openai/v1/chat/completions",
        defaultModel: "llama-3.3-70b-versatile",
        keyHint: "gsk_..."
    },
    deepseek: {
        id: "deepseek",
        label: "DeepSeek",
        baseUrl: "https://api.deepseek.com/chat/completions",
        defaultModel: "deepseek-chat",
        keyHint: "sk-..."
    },
    openrouter: {
        id: "openrouter",
        label: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        defaultModel: "deepseek/deepseek-chat",
        keyHint: "sk-or-..."
    },
    openai: {
        id: "openai",
        label: "OpenAI",
        baseUrl: "https://api.openai.com/v1/chat/completions",
        defaultModel: "gpt-4o-mini",
        keyHint: "sk-..."
    },
    custom: {
        id: "custom",
        label: "Custom (OpenAI-compatible)",
        baseUrl: "",
        defaultModel: "",
        keyHint: "your API key"
    }
};

export const AI_PROVIDER_OPTIONS = Object.values(AI_PROVIDERS).map(provider => ({
    label: provider.label,
    value: provider.id,
    default: provider.id === "groq"
}));

export const AI_SYSTEM_PROMPT = `You are a translator specializing in translating non-English text to English.

Supported source languages:
- Roman Hindi/Urdu: Hindi or Urdu written in Latin/Roman script
- Indonesian (Bahasa Indonesia): informal speech, internet slang, abbreviations

Rules:
1. Translate to natural English
2. Handle slang and abbreviations appropriately
3. Preserve tone and meaning
4. If already English, return as-is
5. ONLY output the translation — no quotes or explanations`;

export interface AiRequestConfig {
    baseUrl: string;
    model: string;
    apiKey: string;
}

export function resolveAiConfig(
    providerId: AiProviderId,
    apiKey: string,
    modelOverride: string,
    customBaseUrl: string
): AiRequestConfig | null {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) return null;

    const provider = AI_PROVIDERS[providerId] ?? AI_PROVIDERS.groq;
    const baseUrl = providerId === "custom"
        ? customBaseUrl.trim()
        : provider.baseUrl;

    if (!baseUrl) return null;

    const model = modelOverride.trim() || provider.defaultModel;
    if (!model) return null;

    return {
        baseUrl,
        model,
        apiKey: trimmedKey
    };
}
