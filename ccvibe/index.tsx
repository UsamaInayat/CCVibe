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
import { migrateLegacySettings, settings } from "./settings";
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

    settings,

    patches: [
        {
            // Patch the message content renderer (same anchor as FakeNitro)
            find: '["strong","em","u","text","inlineCode","s","spoiler"]',
            replacement: [
                {
                    // Discord builds with hasBailedAst (older + current Vencord main)
                    match: /(?=return{hasSpoilerEmbeds:\i,hasBailedAst:\i,content:(\i))/,
                    replace: (_, content) => `${content}=$self.transformContent(${content});`
                },
                {
                    // Discord builds without hasBailedAst (newer Discord)
                    match: /(?=return{hasSpoilerEmbeds:\i,content:(\i)(?!,hasBailedAst))/,
                    replace: (_, content) => `${content}=$self.transformContent(${content});`
                }
            ]
        }
    ],

    transformContent(content: any[]) {
        if (!settings.store.enabled) return content;
        if (!Array.isArray(content)) return content;

        try {
            return this.processContent([...content]);
        } catch (e) {
            console.error("[CCVibe] Error transforming content:", e);
            return content;
        }
    },

    processContent(content: any[]): any[] {
        for (let i = 0; i < content.length; i++) {
            const item = content[i];

            if (typeof item === "string") {
                const processed = this.processText(item);
                if (processed !== item) {
                    content[i] = processed;
                }
                continue;
            }

            if (item?.props) {
                const processed = this.processElement(item);
                if (processed !== item) {
                    content[i] = processed;
                }
            }
        }

        return content;
    },

    processElement(item: any): any {
        const children = item.props?.children;
        if (children == null) return item;

        if (typeof children === "string") {
            const processed = this.processText(children);
            if (processed === children) return item;
            return { ...item, props: { ...item.props, children: processed } };
        }

        if (Array.isArray(children)) {
            const processedChildren = this.processContent([...children]);
            if (processedChildren === children) return item;
            return { ...item, props: { ...item.props, children: processedChildren } };
        }

        if (typeof children === "object" && children?.props) {
            const processedChild = this.processElement(children);
            if (processedChild === children) return item;
            return { ...item, props: { ...item.props, children: processedChild } };
        }

        return item;
    },

    processText(text: string): string | ReactElement {
        if (!text || text.length < 4) return text;

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
        migrateLegacySettings();
        console.log("[CCVibe] Plugin starting (Hindi/Urdu + Indonesian)...");

        const nativeAvailable = await requestCspOverride();
        if (nativeAvailable) {
            console.log("[CCVibe] Native module ready — AI + Google translation enabled.");
        } else {
            console.log("[CCVibe] Native module unavailable — using renderer fallback (rebuild Vencord for full support).");
        }
    },

    stop() {
        console.log("[CCVibe] Plugin stopped!");
    }
});
