/*
 * CCVibe - Auto-translate Roman Hindi/Urdu to English
 * A Vencord plugin for Discord
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable automatic translation of Hindi/Urdu messages",
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
