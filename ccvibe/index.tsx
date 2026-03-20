/*
 * CCVibe - Auto-translate Roman Hindi/Urdu to English
 * A Vencord plugin for Discord
 *
 * Automatically detects and translates Romanized Hindi/Urdu messages
 * to English with INLINE replacement. Hover to see original.
 */

import "./styles.css";

import definePlugin from "@utils/types";
import { lodash } from "@webpack/common";
import { ReactElement } from "react";

import { isLikelyHindiUrdu } from "./detector";
import { settings } from "./settings";
import { TranslatedText } from "./TranslatedText";
import { requestCspOverride, translateToEnglish } from "./translate";

// Cache for translations: text -> translated text
const translationCache = new Map<string, string>();

// Pending translations to avoid duplicate requests
const pendingTranslations = new Set<string>();

export default definePlugin({
    name: "CCVibe",
    description: "Auto-translate Roman Hindi/Urdu messages to English (inline replacement)",
    authors: [
        {
            name: "CCVibe",
            id: 0n
        }
    ],
    dependencies: ["MessageUpdaterAPI"],

    settings,

    patches: [
        {
            // Patch the message content renderer
            find: '["strong","em","u","text","inlineCode","s","spoiler"]',
            replacement: {
                // Match where content is about to be returned
                match: /(?=return{hasSpoilerEmbeds:\i,hasBailedAst:\i,content:(\i))/,
                // Intercept and potentially transform the content
                replace: (_, content) => `${content}=$self.transformContent(${content});`
            }
        }
    ],

    // Transform message content if it contains Hindi/Urdu text
    transformContent(content: any[]) {
        // Skip if disabled
        if (!settings.store.enabled) return content;

        // Skip if not an array
        if (!Array.isArray(content)) return content;

        try {
            // Deep clone to avoid mutating original
            const clonedContent = lodash.cloneDeep(content);
            return this.processContent(clonedContent);
        } catch (e) {
            console.error("[CCVibe] Error transforming content:", e);
            return content;
        }
    },

    // Recursively process content array
    processContent(content: any[]): any[] {
        for (let i = 0; i < content.length; i++) {
            const item = content[i];

            // Handle string content directly
            if (typeof item === "string") {
                const processed = this.processText(item);
                if (processed !== item) {
                    content[i] = processed;
                }
                continue;
            }

            // Handle React elements
            if (item?.props?.children) {
                if (typeof item.props.children === "string") {
                    const processed = this.processText(item.props.children);
                    if (processed !== item.props.children) {
                        item.props.children = processed;
                    }
                } else if (Array.isArray(item.props.children)) {
                    item.props.children = this.processContent(item.props.children);
                }
            }
        }

        return content;
    },

    // Process a text string - return translated component or original
    processText(text: string): string | ReactElement {
        // Skip short or non-Hindi/Urdu text
        if (!text || text.length < 4 || !isLikelyHindiUrdu(text)) {
            return text;
        }

        // Check if we have a cached translation
        const cached = translationCache.get(text);
        if (cached) {
            return (
                <TranslatedText
                    key={`ccvibe-${text.substring(0, 20)}`}
                    original={text}
                    translated={cached}
                    showOriginalOnHover={settings.store.showOriginalOnHover}
                />
            );
        }

        // Start async translation if not already pending
        if (!pendingTranslations.has(text)) {
            pendingTranslations.add(text);

            translateToEnglish(text).then(result => {
                pendingTranslations.delete(text);

                if (result.translated !== result.original) {
                    translationCache.set(text, result.translated);
                    // Note: We can't easily trigger a re-render here since we don't have message context
                    // The translation will show on next render (scroll away and back, or new message in channel)
                    console.log(`[CCVibe] Translated: "${text}" -> "${result.translated}"`);
                }
            }).catch(e => {
                pendingTranslations.delete(text);
                console.error("[CCVibe] Translation failed:", e);
            });
        }

        // Return original text while translation is pending
        return text;
    },

    async start() {
        console.log("[CCVibe] Plugin starting...");

        // Check if native module is available for Groq API
        const nativeAvailable = await requestCspOverride();
        if (nativeAvailable) {
            console.log("[CCVibe] Plugin started - Groq AI translation enabled via native module!");
        } else {
            console.log("[CCVibe] Plugin started - Using Google Translate (native module not available)");
        }
    },

    stop() {
        console.log("[CCVibe] Plugin stopped!");
        translationCache.clear();
        pendingTranslations.clear();
    }
});
