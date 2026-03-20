/*
 * CCVibe - Auto-translate Roman Hindi/Urdu and Indonesian to English
 * A Vencord plugin for Discord
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

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
    googleApiKey: {
        type: OptionType.STRING,
        description: "Google Translate API key (get one from Google Cloud Console)",
        default: "",
        placeholder: "AIzaSy..."
    },
    groqApiKey: {
        type: OptionType.STRING,
        description: "Groq API key for AI-powered translation (get one from console.groq.com)",
        default: "",
        placeholder: "gsk_..."
    }
});
