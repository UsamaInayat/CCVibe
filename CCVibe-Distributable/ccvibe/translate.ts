/*
 * CCVibe - Auto-translate Roman Hindi/Urdu and Indonesian to English
 * Smart routing: picks best translator based on sentence analysis
 */

import { PluginNative } from "@utils/types";

import { AiProviderId, AI_SYSTEM_PROMPT, resolveAiConfig } from "./aiProviders";
import { migrateLegacySettings, settings } from "./settings";

export interface TranslationResult {
    original: string;
    translated: string;
    sourceLanguage: string;
}

// Native module for Groq API calls (runs in main process, bypasses CSP)
const Native = VencordNative.pluginHelpers.CCVibe as PluginNative<typeof import("./native")>;

// In-memory cache to avoid repeated API calls
const translationCache = new Map<string, TranslationResult>();
const wordCache = new Map<string, string>();
const inflightTranslations = new Map<string, Promise<TranslationResult>>();

// Maximum cache size to prevent memory issues
const MAX_CACHE_SIZE = 500;

// Profanity/slang keywords - use Dictionary + Google for these (unfiltered)
const PROFANITY_KEYWORDS = new Set([
    // Hindi/Urdu profanity
    "lun", "lund", "lora", "gandu", "gandhu", "gandy",
    "chutiya", "chutiye", "chutia", "chuut", "chut",
    "bhosdike", "bhosdi", "bsdk", "madarchod", "mc", "bc",
    "behenchod", "bhenchod", "bhen", "gaand", "gand",
    "harami", "haramkhor", "kutta", "kutte", "kutty",
    "kamina", "kamine", "kameena", "sala", "saale", "saala",
    "randi", "rand", "maa", "baap", "teri", "meri",
    // Indonesian profanity
    "anjing", "anjir", "anjay", "bangsat", "babi", "kampret",
    "keparat", "bajingan", "tai", "goblok", "bodoh", "tolol",
    "bego", "setan", "sialan", "kontol", "ngentot", "jancok", "dancok"
]);

// Common abbreviations - need word-by-word expansion
const ABBREVIATIONS = new Set([
    // Hindi/Urdu abbreviations
    "tm", "ap", "nhi", "ni", "hy", "hen", "kro", "kra",
    "rha", "rhi", "rhe", "kr", "sy",
    "toh", "bhi", "kya", "kyu", "kyun", "aur",
    // Indonesian abbreviations (genuinely shortened forms only)
    "gw", "lo", "lu", "bgt", "yg", "dgn",
    "krn", "kl", "klo", "tp", "jd", "ntar", "msh", "gmn",
    "pgn", "gpp"
]);

// Slang dictionary for direct lookups
const SLANG_DICTIONARY: Record<string, string> = {
    // Profanity
    "lun": "dick",
    "lund": "dick",
    "lora": "dick",
    "gandu": "asshole",
    "gandhu": "asshole",
    "gandy": "asshole",
    "chutiya": "fucker/idiot",
    "chutiye": "fucker/idiot",
    "chutia": "fucker/idiot",
    "chut": "pussy",
    "chuut": "pussy",
    "bhosdike": "motherfucker",
    "bhosdi": "motherfucker",
    "bsdk": "motherfucker",
    "madarchod": "motherfucker",
    "mc": "motherfucker",
    "behenchod": "sisterfucker",
    "bhenchod": "sisterfucker",
    "bhen chod": "sisterfucker",
    "gaand": "ass",
    "gand": "ass",
    "harami": "bastard",
    "haramkhor": "bastard",
    "haram": "bastard",
    "kutta": "dog (insult)",
    "kutte": "dog (insult)",
    "kutty": "dog (insult)",
    "kamina": "bastard",
    "kamine": "bastard",
    "kameena": "bastard",
    "sala": "bastard",
    "saale": "bastard",
    "saala": "bastard",
    "ullu": "idiot (owl)",
    "gadha": "donkey/idiot",
    "bakwas": "nonsense/bullshit",
    "bakwaas": "nonsense/bullshit",
    "bewakoof": "fool",
    "pagal": "crazy",
    "paagal": "crazy",
    "chup": "shut up",
    "chupp": "shut up",
    "randi": "whore",
    "rand": "whore",

    // Hindi/Urdu abbreviations
    "tm": "you",
    "ap": "you (formal)",
    "nhi": "no",
    "ni": "no",
    "hy": "is",
    "hen": "are",
    "kro": "do",
    "kra": "did",
    "rha": "doing",
    "rhi": "doing",
    "rhe": "doing",
    "ho": "are",
    "kr": "do",
    "sy": "from",
    "k": "of",
    "b": "also",
    "v": "also",
    "p": "on",
    "h": "is",
    "toh": "then",
    "bhi": "also",
    "kya": "what",
    "kyu": "why",
    "kyun": "why",
    "aur": "and",

    // Indonesian profanity
    "anjing": "dog (insult)/damn",
    "anjir": "damn (euphemism)",
    "anjay": "damn/wow (euphemism)",
    "bangsat": "scoundrel/bastard",
    "babi": "pig (insult)",
    "kampret": "damn it",
    "keparat": "bastard",
    "bajingan": "scoundrel/villain",
    "tai": "shit",
    "goblok": "stupid/idiot",
    "bodoh": "stupid",
    "tolol": "idiot/dumb",
    "bego": "dumb/stupid",
    "setan": "devil/damn",
    "sialan": "damn it",
    "kontol": "dick",
    "ngentot": "fuck",
    "jancok": "fuck (Javanese)",
    "dancok": "fuck (Javanese)",

    // Indonesian internet slang
    "wkwk": "haha",
    "wkwkwk": "hahaha",
    "wkwkwkwk": "hahaha",
    "mantap": "awesome/cool",
    "mantul": "awesome",
    "gaskeun": "let's go/go for it",
    "kepo": "nosy/curious",
    "gabut": "bored with nothing to do",
    "baper": "easily emotional/oversensitive",
    "lebay": "overdramatic/exaggerating",
    "mager": "too lazy to move",
    "santuy": "chill/relax",
    "kuy": "let's go",
    "skuy": "let's go",
    "bucin": "lovesick person",
    "ngab": "bro/buddy",
    "gapapa": "it's okay",
    "gpp": "it's okay",

    // Indonesian abbreviations
    "gw": "I (me)",
    "gue": "I (me)",
    "gua": "I (me)",
    "lo": "you",
    "lu": "you",
    "bgt": "very",
    "yg": "that/which",
    "dgn": "with",
    "krn": "because",
    "kl": "if",
    "klo": "if",
    "tp": "but",
    "jd": "so/become",
    "ntar": "later",
    "msh": "still",
    "gmn": "how",
    "pgn": "want",
    "udah": "already",
    "emang": "indeed/really",
    "gimana": "how",
    "kayak": "like/similar to",
    "banget": "very/extremely",
    "dong": "you know/please (particle)",
    "sih": "actually/really (particle)",
    "deh": "okay then (particle)",
    "lho": "hey/really (particle)",
    "kan": "right?/isn't it (particle)",
    "nih": "here/this (particle)",
    "lah": "come on/okay (particle)",
};

// Track if native module is available
let nativeAvailable: boolean | null = null;

// =============================================================================
// SENTENCE ANALYSIS - Determines which translator to use
// =============================================================================

type TranslatorType = "dictionary" | "google" | "ai" | "word-by-word";

interface SentenceAnalysis {
    wordCount: number;
    hasProfanity: boolean;
    hasAbbreviations: boolean;
    abbreviationRatio: number;  // % of words that are abbreviations
    isQuestion: boolean;
    isConversational: boolean;
    recommendedTranslator: TranslatorType;
}

/**
 * Analyze sentence to determine best translation method
 */
function analyzeSentence(text: string, language: "hi-ur" | "id" = "hi-ur"): SentenceAnalysis {
    const lowerText = text.toLowerCase().trim();
    const words = lowerText.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // Check for profanity
    const hasProfanity = words.some(word => PROFANITY_KEYWORDS.has(word));

    // Check for abbreviations
    const abbreviationCount = words.filter(word => ABBREVIATIONS.has(word)).length;
    const hasAbbreviations = abbreviationCount > 0;
    const abbreviationRatio = wordCount > 0 ? abbreviationCount / wordCount : 0;

    // Language-specific question and conversational signals
    const isQuestion = language === "id"
        ? /\?$/.test(text) || /^(apa|siapa|kapan|kenapa|mengapa|bagaimana|gimana|berapa)\b/i.test(lowerText)
            || /\b(gimana|kenapa|ngapain)\b/i.test(lowerText)
        : /\?$/.test(text) || /^(kya|kyu|kyun|kaisa|kaisi|kaise|kahan|kab|kon|kaun)\b/i.test(lowerText)
            || /\b(kaise|kaisa|kaisi|kahan|kab|kya|kyu|kyun)\b/i.test(lowerText);

    const conversationalPatterns = language === "id" ? [
        /\b(teman|kawan|sahabat|bro|sis|bang|om|tante|kakak|adik)\b/i,
        /\b(oke|sip|mantap|santuy|gaskeun|kuy)\b/i,
        /\b(gimana|gitu|gini|kayak|emang)\b/i,
        /\b(dong|sih|deh|nih|lho)\b/i,
    ] : [
        /\b(yaar|bhai|dost|bro|sis|tum|aap|hum|log)\b/i,
        /\b(acha|theek|okay|ok|haan|han|ji)\b/i,
        /\b(kaise ho|kaisay ho|kya hal|sab theek)\b/i,
        /\b(chal|chalo|dekh|sun|bol)\b/i,
    ];
    const isConversational = conversationalPatterns.some(p => p.test(lowerText));

    // Determine best translator
    let recommendedTranslator: TranslatorType;

    // Single word in dictionary → Dictionary
    if (wordCount === 1 && SLANG_DICTIONARY[lowerText]) {
        recommendedTranslator = "dictionary";
    }
    // Contains profanity → Google (unfiltered) + Dictionary fallback
    else if (hasProfanity) {
        recommendedTranslator = "google";  // Google is unfiltered for profanity
    }
    // Heavy abbreviations (>40% of words) → Word-by-word
    else if (abbreviationRatio > 0.4) {
        recommendedTranslator = "word-by-word";
    }
    // Short phrase (1-3 words) → Google (literal is fine)
    else if (wordCount <= 3) {
        recommendedTranslator = "google";
    }
    // Conversational / question sentences → AI (full-sentence context)
    else if (wordCount >= 3 && (isConversational || isQuestion)) {
        recommendedTranslator = "ai";
    }
    // Default → Google
    else {
        recommendedTranslator = "google";
    }

    return {
        wordCount,
        hasProfanity,
        hasAbbreviations,
        abbreviationRatio,
        isQuestion,
        isConversational,
        recommendedTranslator
    };
}

// =============================================================================
// TRANSLATION FUNCTIONS
// =============================================================================

/**
 * Check if native module is available
 */
async function checkNativeAvailable(): Promise<boolean> {
    if (nativeAvailable !== null) return nativeAvailable;

    try {
        if (Native && typeof Native.translateWithAI === "function") {
            nativeAvailable = true;
        } else if (Native && typeof Native.translateWithGroq === "function") {
            nativeAvailable = true;
        } else {
            nativeAvailable = false;
        }
    } catch {
        nativeAvailable = false;
    }

    return nativeAvailable;
}

function getAiApiKey(): string {
    migrateLegacySettings();
    return settings.store.aiApiKey.trim();
}

function getAiConfig() {
    return resolveAiConfig(
        settings.store.aiProvider as AiProviderId,
        getAiApiKey(),
        settings.store.aiModel,
        settings.store.customApiUrl
    );
}

/**
 * Translate using configured AI provider (native module, then renderer fallback)
 */
async function aiTranslate(text: string): Promise<string | null> {
    const config = getAiConfig();
    if (!config) return null;

    try {
        const isAvailable = await checkNativeAvailable();
        if (isAvailable && Native) {
            const result = typeof Native.translateWithAI === "function"
                ? await Native.translateWithAI({
                    text,
                    apiKey: config.apiKey,
                    baseUrl: config.baseUrl,
                    model: config.model
                })
                : await Native.translateWithGroq(text, config.apiKey);

            if (result.success && result.translation) {
                const accepted = acceptTranslation(text, result.translation);
                if (accepted) return accepted;
            } else if (result.error) {
                console.warn("[CCVibe] AI error (native):", result.error);
            }
        }

        return await aiTranslateRenderer(text, config);
    } catch (e) {
        console.error("[CCVibe] AI translation failed:", e);
        return null;
    }
}

async function aiTranslateRenderer(text: string, config: { baseUrl: string; model: string; apiKey: string }): Promise<string | null> {
    try {
        const res = await fetch(config.baseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: "system", content: AI_SYSTEM_PROMPT },
                    { role: "user", content: text }
                ],
                max_tokens: 256,
                temperature: 0.3
            })
        });

        if (!res.ok) {
            console.warn("[CCVibe] AI error (renderer):", res.status);
            return null;
        }

        const data = await res.json() as {
            choices?: { message?: { content?: string } }[];
        };
        const translation = data.choices?.[0]?.message?.content?.trim();
        return acceptTranslation(text, translation ?? null);
    } catch (e) {
        console.warn("[CCVibe] AI renderer request failed:", e);
        return null;
    }
}

/**
 * Google Cloud Translation API v2 (literal).
 * Cloud Console keys must use translation.googleapis.com — not translate-pa / gtx (those return 403).
 */
async function googleTranslate(text: string, sourceLang: string): Promise<string | null> {
    const apiKey = settings.store.googleApiKey;
    if (!apiKey) return null;

    if (Native && typeof Native.translateWithGoogle === "function") {
        try {
            const result = await Native.translateWithGoogle(text, apiKey, sourceLang);
            if (result.success && result.translation) {
                return result.translation;
            }
        } catch (e) {
            console.warn("[CCVibe] Google native failed, trying renderer:", e);
        }
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
        if (!res.ok) return null;

        const data = await res.json() as {
            data?: { translations?: { translatedText?: string }[] };
        };
        return data?.data?.translations?.[0]?.translatedText ?? null;
    } catch (e) {
        console.warn("[CCVibe] Google renderer request failed:", e);
        return null;
    }
}

/**
 * Check if translation is meaningfully different from original
 */
function isRealTranslation(original: string, translated: string): boolean {
    if (!translated) return false;
    const normOriginal = original.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normTranslated = translated.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normOriginal !== normTranslated;
}

/**
 * Reject partial translations like "tum log kaise ho" -> "tum log kaise are"
 * where only one dictionary word changed but the sentence stayed mostly untranslated.
 */
export function isAcceptableTranslation(original: string, translated: string): boolean {
    if (!isRealTranslation(original, translated)) return false;

    const origWords = original.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (origWords.length <= 2) return true;

    const transWords = translated.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const transNorms = new Set(transWords.map(w => w.replace(/[^a-z0-9]/g, "")));

    let unchangedCount = 0;
    for (const word of origWords) {
        const norm = word.replace(/[^a-z0-9]/g, "");
        if (norm.length > 1 && transNorms.has(norm)) {
            unchangedCount++;
        }
    }

    const unchangedRatio = unchangedCount / origWords.length;
    return unchangedRatio <= 0.5;
}

function acceptTranslation(original: string, translated: string | null): string | null {
    if (translated && isAcceptableTranslation(original, translated)) return translated;
    return null;
}

/**
 * Try Google Translate with an ordered list of source language codes.
 * Returns the first successful, meaningfully different translation.
 */
async function tryTranslateWithLangs(text: string, langs: string[]): Promise<string | null> {
    for (const lang of langs) {
        const result = await googleTranslate(text, lang);
        if (result) return acceptTranslation(text, result);
    }
    return null;
}

const tryGoogleTranslate = (text: string) => tryTranslateWithLangs(text, ["hi", "auto"]);
const tryIndonesianTranslate = (text: string) => tryTranslateWithLangs(text, ["id", "auto"]);

/**
 * Translate a single word — abbreviations only when expanding shorthand (word-by-word mode)
 */
async function translateWord(word: string, abbreviationsOnly = false): Promise<string> {
    const lowerWord = word.toLowerCase();

    if (wordCache.has(lowerWord)) {
        return wordCache.get(lowerWord)!;
    }

    if (abbreviationsOnly) {
        if (ABBREVIATIONS.has(lowerWord) && SLANG_DICTIONARY[lowerWord]) {
            const result = SLANG_DICTIONARY[lowerWord];
            wordCache.set(lowerWord, result);
            return result;
        }
    } else if (SLANG_DICTIONARY[lowerWord]) {
        const result = SLANG_DICTIONARY[lowerWord];
        wordCache.set(lowerWord, result);
        return result;
    }

    const googleResult = await tryGoogleTranslate(lowerWord);
    if (googleResult) {
        wordCache.set(lowerWord, googleResult);
        return googleResult;
    }

    return word;
}

/**
 * Expand abbreviation-heavy text word-by-word (never used for normal full sentences)
 */
async function translateWordByWord(text: string): Promise<string> {
    const words = text.split(/(\s+)/);
    const translatedParts: string[] = [];

    for (const part of words) {
        if (/^\s+$/.test(part) || part.length <= 1 || /^[^a-zA-Z]+$/.test(part)) {
            translatedParts.push(part);
            continue;
        }
        translatedParts.push(await translateWord(part, true));
    }

    return translatedParts.join("");
}

// =============================================================================
// MAIN TRANSLATION FUNCTION - Smart Routing
// =============================================================================

/**
 * Main translation function with smart routing
 * @param text Text to translate
 * @param language Source language hint: "hi-ur" for Hindi/Urdu (default), "id" for Indonesian
 */
export async function translateToEnglish(text: string, language: "hi-ur" | "id" = "hi-ur"): Promise<TranslationResult> {
    const cached = translationCache.get(text);
    if (cached) {
        if (isAcceptableTranslation(text, cached.translated)) return cached;
        translationCache.delete(text);
    }

    const inflight = inflightTranslations.get(text);
    if (inflight) return inflight;

    const promise = translateToEnglishInternal(text, language);
    inflightTranslations.set(text, promise);

    try {
        return await promise;
    } finally {
        inflightTranslations.delete(text);
    }
}

async function translateToEnglishInternal(text: string, language: "hi-ur" | "id" = "hi-ur"): Promise<TranslationResult> {
    const cacheAndReturn = (translated: string, source: string): TranslationResult => {
        if (!isAcceptableTranslation(text, translated)) {
            return { original: text, translated: text, sourceLanguage: "unchanged" };
        }
        const result: TranslationResult = { original: text, translated, sourceLanguage: source };
        if (translationCache.size >= MAX_CACHE_SIZE) {
            const firstKey = translationCache.keys().next().value;
            if (firstKey) translationCache.delete(firstKey);
        }
        translationCache.set(text, result);
        return result;
    };

    const strategy = settings.store.translationStrategy;
    const googleFn = language === "id" ? tryIndonesianTranslate : tryGoogleTranslate;

    const tryGoogle = () => googleFn(text);
    const tryAi = () => aiTranslate(text);

    async function tryFullSentence(): Promise<string | null> {
        if (strategy === "quality") {
            return (await tryAi()) ?? (await tryGoogle());
        }
        return (await tryGoogle()) ?? (await tryAi());
    }

    async function routePrimary(recommended: TranslatorType): Promise<string | null> {
        switch (recommended) {
            case "dictionary":
            case "google":
                return tryGoogle();
            case "ai":
                return tryFullSentence();
            case "word-by-word": {
                const wbw = await translateWordByWord(text);
                return acceptTranslation(text, wbw) ?? tryFullSentence();
            }
            default:
                return null;
        }
    }

    try {
        const analysis = analyzeSentence(text, language);

        const lowerText = text.toLowerCase().trim();
        if (SLANG_DICTIONARY[lowerText]) {
            return cacheAndReturn(SLANG_DICTIONARY[lowerText], "dictionary");
        }

        let result = await routePrimary(analysis.recommendedTranslator);

        if (result) {
            const source = analysis.recommendedTranslator === "word-by-word"
                ? "word-by-word"
                : analysis.recommendedTranslator === "ai"
                    ? settings.store.aiProvider
                    : analysis.recommendedTranslator === "dictionary"
                        ? "dictionary"
                        : "google";
            return cacheAndReturn(result, source);
        }

        result = await tryFullSentence();
        if (result) {
            return cacheAndReturn(result, getAiConfig() ? settings.store.aiProvider : "google");
        }

        // Word-by-word only for abbreviation-heavy shorthand — never as a lazy fallback
        if (analysis.abbreviationRatio > 0.4) {
            const wordByWord = await translateWordByWord(text);
            const accepted = acceptTranslation(text, wordByWord);
            if (accepted) {
                return cacheAndReturn(accepted, "word-by-word");
            }
        }

        return { original: text, translated: text, sourceLanguage: "unchanged" };

    } catch (error) {
        console.error("[CCVibe] Translation error:", error);
        return { original: text, translated: text, sourceLanguage: "error" };
    }
}

export function getCachedTranslation(text: string): string | null {
    const cached = translationCache.get(text);
    if (!cached) return null;
    if (!isAcceptableTranslation(text, cached.translated)) return null;
    return cached.translated;
}

// =============================================================================
// EXPORTS
// =============================================================================

export async function requestCspOverride(): Promise<boolean> {
    const available = await checkNativeAvailable();
    // Google/AI can still work via renderer fallback even without native
    return available || Boolean(settings.store.googleApiKey || getAiApiKey());
}

export function clearCache(): void {
    translationCache.clear();
    wordCache.clear();
    inflightTranslations.clear();
}

export function getCacheStats() {
    return { size: translationCache.size, maxSize: MAX_CACHE_SIZE };
}
