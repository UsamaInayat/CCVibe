/*
 * CCVibe - Auto-translate Roman Hindi/Urdu and Indonesian to English
 * A Vencord plugin for Discord
 */

import "./styles.css";

import definePlugin from "@utils/types";
import { ReactElement } from "react";

import { detectLanguage, extractPlainText, isPlainTextContent } from "./messageContent";
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
            find: '["strong","em","u","text","inlineCode","s","spoiler"]',
            replacement: [
                {
                    match: /(?=return\{hasSpoilerEmbeds:\i,hasBailedAst:\i,content:(\i))/,
                    replace: (_, content) => `${content}=$self.transformContent(${content});`
                },
                {
                    match: /(?=return\{hasSpoilerEmbeds:\i,content:(\i)\})/,
                    replace: (_, content) => `${content}=$self.transformContent(${content});`
                },
                {
                    match: /(?=return\{content:(\i),hasSpoilerEmbeds:\i\})/,
                    replace: (_, content) => `${content}=$self.transformContent(${content});`
                }
            ]
        }
    ],

    transformContent(content: any[]) {
        if (!settings.store.enabled) return content;
        if (!Array.isArray(content)) return content;

        try {
            const plainText = extractPlainText(content).trim();

            // Plain messages: replace the whole content tree with one inline translator
            if (plainText.length >= 4 && isPlainTextContent(content)) {
                const lang = detectLanguage(plainText);
                if (lang) {
                    return [this.renderTranslated(plainText, lang)];
                }
            }

            return this.processContent([...content]);
        } catch (e) {
            console.error("[CCVibe] Error transforming content:", e);
            return content;
        }
    },

    renderTranslated(text: string, language: "hi-ur" | "id"): ReactElement {
        return (
            <TranslatedText
                key={`ccvibe-${language}-${text.substring(0, 20)}`}
                original={text}
                language={language}
                showOriginalOnHover={settings.store.showOriginalOnHover}
            />
        );
    },

    processContent(content: any[]): any[] {
        const plainText = extractPlainText(content).trim();
        const fullLang = plainText.length >= 4 ? detectLanguage(plainText) : null;

        for (let i = 0; i < content.length; i++) {
            const item = content[i];

            if (typeof item === "string") {
                const processed = this.processText(item, fullLang);
                if (processed !== item) {
                    content[i] = processed;
                }
                continue;
            }

            if (item?.props) {
                const processed = this.processElement(item, fullLang);
                if (processed !== item) {
                    content[i] = processed;
                }
            }
        }

        return content;
    },

    processElement(item: any, fullLang: "hi-ur" | "id" | null): any {
        const children = item.props?.children;
        if (children == null) return item;

        if (typeof children === "string") {
            const processed = this.processText(children, fullLang);
            if (processed === children) return item;
            return { ...item, props: { ...item.props, children: processed } };
        }

        if (Array.isArray(children)) {
            const processedChildren = this.processContent(children);
            if (processedChildren === children) return item;
            return { ...item, props: { ...item.props, children: processedChildren } };
        }

        if (typeof children === "object" && children?.props) {
            const processedChild = this.processElement(children, fullLang);
            if (processedChild === children) return item;
            return { ...item, props: { ...item.props, children: processedChild } };
        }

        return item;
    },

    processText(text: string, fullLang: "hi-ur" | "id" | null = null): string | ReactElement {
        if (!text?.trim()) return text;

        const lang = fullLang ?? detectLanguage(text);
        if (!lang) return text;

        // Short fragments are part of a longer detected message — wrap using full context when possible
        if (text.trim().length < 4 && fullLang) {
            return text;
        }
        if (text.trim().length < 4) return text;

        return this.renderTranslated(text, lang);
    },

    async start() {
        migrateLegacySettings();
        console.log("[CCVibe] Plugin starting (Hindi/Urdu + Indonesian)...");

        const nativeAvailable = await requestCspOverride();
        if (nativeAvailable) {
            console.log("[CCVibe] Native module ready — AI + Google translation enabled.");
        } else {
            console.log("[CCVibe] Native module unavailable — using renderer API fallback.");
        }
    },

    stop() {
        console.log("[CCVibe] Plugin stopped!");
    }
});
