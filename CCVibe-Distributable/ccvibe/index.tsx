/*
 * CCVibe - Auto-translate Roman Hindi/Urdu and Indonesian to English
 * A Vencord plugin for Discord
 *
 * Automatically detects and translates Romanized Hindi/Urdu and Indonesian
 * messages to English with INLINE replacement. Hover to see original.
 */

import "./styles.css";

import definePlugin from "@utils/types";
import { ReactElement } from "react";

import { isLikelyHindiUrdu, isLikelyIndonesian } from "./detector";
import { settings } from "./settings";
import { TranslatedText } from "./TranslatedText";
import { requestCspOverride } from "./translate";

export default definePlugin({
    name: "CCVibe",
    description: "Auto-translate Roman Hindi/Urdu and Indonesian messages to English (inline replacement)",
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
            return this.processContent([...content]);
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

            // Handle React elements (shallow copy only when mutating)
            if (item?.props?.children) {
                if (typeof item.props.children === "string") {
                    const processed = this.processText(item.props.children);
                    if (processed !== item.props.children) {
                        content[i] = {
                            ...item,
                            props: { ...item.props, children: processed }
                        };
                    }
                } else if (Array.isArray(item.props.children)) {
                    const processedChildren = this.processContent(item.props.children);
                    if (processedChildren !== item.props.children) {
                        content[i] = {
                            ...item,
                            props: { ...item.props, children: processedChildren }
                        };
                    }
                }
            }
        }

        return content;
    },

    // Process a text string - return translated component or original
    processText(text: string): string | ReactElement {
        if (!text || text.length < 4) return text;

        // Determine which language was detected based on user settings
        let detectedLang: "hi-ur" | "id" | null = null;
        if (settings.store.detectHindiUrdu && isLikelyHindiUrdu(text)) {
            detectedLang = "hi-ur";
        } else if (settings.store.detectIndonesian && isLikelyIndonesian(text)) {
            detectedLang = "id";
        }

        if (!detectedLang) return text;

        return (
            <TranslatedText
                key={`ccvibe-${detectedLang}-${text.substring(0, 20)}`}
                original={text}
                language={detectedLang}
                showOriginalOnHover={settings.store.showOriginalOnHover}
            />
        );
    },

    async start() {
        console.log("[CCVibe] Plugin starting (Hindi/Urdu + Indonesian)...");

        // Native module runs Groq + Google Cloud Translation in the main process (CSP-safe).
        const nativeAvailable = await requestCspOverride();
        if (nativeAvailable) {
            console.log("[CCVibe] Plugin started - Groq + Google Cloud Translation enabled via native module.");
        } else {
            console.log("[CCVibe] Plugin started - Google Cloud Translation from renderer (install native build for Groq + reliable Google).");
        }
    },

    stop() {
        console.log("[CCVibe] Plugin stopped!");
    }
});
