/*
 * CCVibe - Native module for Groq and Google Cloud Translation API calls
 * Runs in Electron's main process - bypasses CSP / CORS restrictions
 */

import { IpcMainInvokeEvent } from "electron";

const GROQ_MODEL = "llama-3.3-70b-versatile";

interface GroqMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface GroqResponse {
    choices?: {
        message?: {
            content?: string;
        };
    }[];
    error?: {
        message?: string;
    };
}

/**
 * Translate text using Groq AI (LLM-based translation)
 * Called from renderer process via IPC
 */
export async function translateWithGroq(
    _: IpcMainInvokeEvent,
    text: string,
    apiKey: string
): Promise<{ success: boolean; translation?: string; error?: string }> {
    if (!apiKey) {
        return { success: false, error: "No Groq API key configured" };
    }

    const messages: GroqMessage[] = [
        {
            role: "system",
            content: `You are a translator specializing in translating non-English text to English.

Supported source languages:
- Roman Hindi/Urdu: Hindi or Urdu written in Latin/Roman script, common in Pakistani and Indian online chat
- Indonesian (Bahasa Indonesia): including informal speech, internet slang, and abbreviations

IMPORTANT RULES:
1. Identify the source language automatically and translate the text to natural English
2. Handle slang, abbreviations, and internet speak appropriately
3. Preserve the tone and meaning
4. If the text is already English or doesn't need translation, return it as-is
5. ONLY output the translation, nothing else - no explanations, no quotes
6. Keep translations concise and natural`
        },
        {
            role: "user",
            content: text
        }
    ];

    try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages,
                max_tokens: 256,
                temperature: 0.3
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("[CCVibe Native] Groq API error:", res.status, errorText);
            return { success: false, error: `API error: ${res.status}` };
        }

        const data: GroqResponse = await res.json();

        if (data.error) {
            console.error("[CCVibe Native] Groq error:", data.error.message);
            return { success: false, error: data.error.message };
        }

        const translation = data.choices?.[0]?.message?.content?.trim();

        if (!translation) {
            return { success: false, error: "No translation in response" };
        }

        console.log(`[CCVibe Native] Translated: "${text}" -> "${translation}"`);
        return { success: true, translation };

    } catch (e) {
        console.error("[CCVibe Native] Request failed:", e);
        return { success: false, error: String(e) };
    }
}

interface GoogleTranslateV2Response {
    data?: {
        translations?: {
            translatedText?: string;
        }[];
    };
    error?: {
        message?: string;
    };
}

/**
 * Translate text using Google Cloud Translation API (Basic) v2.
 * Uses the official endpoint; Cloud Console API keys do not work with translate-pa / gtx.
 */
export async function translateWithGoogle(
    _: IpcMainInvokeEvent,
    text: string,
    apiKey: string,
    sourceLang: string
): Promise<{ success: boolean; translation?: string; error?: string }> {
    if (!apiKey) {
        return { success: false, error: "No Google API key configured" };
    }

    try {
        const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
        const body: Record<string, unknown> = {
            q: text,
            target: "en",
            format: "text",
        };
        if (sourceLang && sourceLang !== "auto") {
            body.source = sourceLang;
        }

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("[CCVibe Native] Google Translate API error:", res.status, errorText);
            return { success: false, error: `API error: ${res.status}` };
        }

        const data: GoogleTranslateV2Response = await res.json();

        if (data.error?.message) {
            console.error("[CCVibe Native] Google API error:", data.error.message);
            return { success: false, error: data.error.message };
        }

        const translation = data.data?.translations?.[0]?.translatedText?.trim();

        if (!translation) {
            return { success: false, error: "No translation in response" };
        }

        return { success: true, translation };
    } catch (e) {
        console.error("[CCVibe Native] Google request failed:", e);
        return { success: false, error: String(e) };
    }
}
