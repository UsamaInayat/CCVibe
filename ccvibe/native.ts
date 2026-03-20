/*
 * CCVibe - Native module for Groq API calls
 * Runs in Electron's main process - bypasses CSP restrictions
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
            content: `You are a translator specializing in Roman Hindi/Urdu (Hindi/Urdu written in Latin script) to English translation.

IMPORTANT RULES:
1. Translate the given Roman Hindi/Urdu text to natural English
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
