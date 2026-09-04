/*
 * CCVibe - Extract and classify Discord message render trees
 */

import { isLikelyHindiUrdu, isLikelyIndonesian } from "./detector";
import { settings } from "./settings";

/** Recursively collect visible text from Discord's parsed message content tree */
export function extractPlainText(nodes: any): string {
    if (nodes == null) return "";
    if (typeof nodes === "string") return nodes;
    if (typeof nodes === "number") return String(nodes);
    if (Array.isArray(nodes)) return nodes.map(extractPlainText).join("");

    const children = nodes.props?.children;
    if (children == null) return "";

    return extractPlainText(children);
}

/** True when content is plain chat text (no links, mentions, code blocks, etc.) */
export function isPlainTextContent(content: any[]): boolean {
    function walk(node: any): boolean {
        if (node == null || typeof node === "string") return true;
        if (Array.isArray(node)) return node.every(walk);

        const props = node.props;
        if (!props) return true;

        if (props.href || props.channelId || props.userId || props.emoji || props.codeBlock) return false;
        if (props.onClick && props.role === "button") return false;

        const typeName = typeof node.type === "string"
            ? node.type
            : (node.type?.displayName || node.type?.name || "");

        if (/link|mention|emoji|code|spoiler|attachment|timestamp|command/i.test(typeName)) {
            return false;
        }

        return walk(props.children);
    }

    return walk(content);
}

export function detectLanguage(text: string): "hi-ur" | "id" | null {
    const trimmed = text.trim();
    if (trimmed.length < 4) return null;

    if (settings.store.detectHindiUrdu && isLikelyHindiUrdu(trimmed)) {
        return "hi-ur";
    }
    if (settings.store.detectIndonesian && isLikelyIndonesian(trimmed)) {
        return "id";
    }
    return null;
}
