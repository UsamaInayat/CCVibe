/*
 * CCVibe - Auto-translate Roman Hindi/Urdu and Indonesian to English
 * A Vencord plugin for Discord
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { AI_PROVIDER_OPTIONS } from "./aiProviders";

export const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable automatic translation",
        default: true
    },
    detectHindiUrdu: {
        type: OptionType.BOOLEAN,
        description: "Detect and translate Roman Hindi/Urdu messages",
        default: true
    },
    detectIndonesian: {
        type: OptionType.BOOLEAN,
        description: "Detect and translate Indonesian (Bahasa Indonesia) messages",
        default: true
    },
    showOriginalOnHover: {
        type: OptionType.BOOLEAN,
        description: "Show original message when hovering over translation",
        default: true
    },
    translationStrategy: {
        type: OptionType.SELECT,
        description: "Translation speed vs quality (Google is fastest, AI is best for slang)",
        options: [
            { label: "Fast — Google first, AI fallback", value: "fast", default: true },
            { label: "Balanced — Google for short text, AI for conversations", value: "balanced" },
            { label: "Quality — AI first for conversational text", value: "quality" }
        ]
    },
    aiProvider: {
        type: OptionType.SELECT,
        description: "AI provider for slang/conversational translation (OpenAI-compatible)",
        options: AI_PROVIDER_OPTIONS
    },
    aiApiKey: {
        type: OptionType.STRING,
        description: "AI provider API key (Groq, DeepSeek, OpenRouter, OpenAI, or custom)",
        default: "",
        placeholder: "gsk_... / sk-... / sk-or-..."
    },
    aiModel: {
        type: OptionType.STRING,
        description: "AI model override (leave empty for provider default)",
        default: "",
        placeholder: "e.g. deepseek-chat, llama-3.3-70b-versatile"
    },
    customApiUrl: {
        type: OptionType.STRING,
        description: "Custom API URL (only used when AI provider is Custom)",
        default: "",
        placeholder: "https://api.example.com/v1/chat/completions",
        disabled: () => settings.store.aiProvider !== "custom"
    },
    googleApiKey: {
        type: OptionType.STRING,
        description: "Google Translate API key (get one from Google Cloud Console)",
        default: "",
        placeholder: "AIzaSy..."
    },
    /** @deprecated Legacy setting — migrated to aiApiKey on load */
    groqApiKey: {
        type: OptionType.STRING,
        description: "Deprecated — use AI API Key instead",
        default: "",
        hidden: true
    }
});

/** Migrate legacy groqApiKey into aiApiKey if needed */
export function migrateLegacySettings() {
    if (!settings.store.aiApiKey && settings.store.groqApiKey) {
        settings.store.aiApiKey = settings.store.groqApiKey;
    }
}
