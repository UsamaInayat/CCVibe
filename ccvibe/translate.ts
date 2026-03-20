/*
 * CCVibe - Auto-translate Roman Hindi/Urdu to English
 * Smart routing: picks best translator based on sentence analysis
 */

import { PluginNative } from "@utils/types";

import { settings } from "./settings";

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

// Maximum cache size to prevent memory issues
const MAX_CACHE_SIZE = 500;

// Profanity/slang keywords - use Dictionary + Google for these (unfiltered)
const PROFANITY_KEYWORDS = new Set([
    "lun", "lund", "lora", "gandu", "gandhu", "gandy",
    "chutiya", "chutiye", "chutia", "chuut", "chut",
    "bhosdike", "bhosdi", "bsdk", "madarchod", "mc", "bc",
    "behenchod", "bhenchod", "bhen", "gaand", "gand",
    "harami", "haramkhor", "kutta", "kutte", "kutty",
    "kamina", "kamine", "kameena", "sala", "saale", "saala",
    "randi", "rand", "maa", "baap", "teri", "meri"
]);

// Common abbreviations - need word-by-word expansion
const ABBREVIATIONS = new Set([
    "tm", "ap", "nhi", "ni", "hy", "hen", "kro", "kra",
    "rha", "rhi", "rhe", "ho", "kr", "sy", "k", "b", "v",
    "p", "h", "toh", "bhi", "kya", "kyu", "kyun", "aur"
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
    "bc": "sisterfucker",
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

    // Abbreviations
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
};

// Track if native module is available
let nativeAvailable: boolean | null = null;

// =============================================================================
// SENTENCE ANALYSIS - Determines which translator to use
// =============================================================================

type TranslatorType = "dictionary" | "google" | "groq" | "word-by-word";

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
function analyzeSentence(text: string): SentenceAnalysis {
    const lowerText = text.toLowerCase().trim();
    const words = lowerText.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // Check for profanity
    const hasProfanity = words.some(word => PROFANITY_KEYWORDS.has(word));

    // Check for abbreviations
    const abbreviationCount = words.filter(word => ABBREVIATIONS.has(word)).length;
    const hasAbbreviations = abbreviationCount > 0;
    const abbreviationRatio = wordCount > 0 ? abbreviationCount / wordCount : 0;

    // Check if question
    const isQuestion = /\?$/.test(text) || /^(kya|kyu|kyun|kaisa|kaisi|kaise|kahan|kab|kon|kaun)\b/i.test(lowerText);

    // Conversational patterns (greetings, casual chat)
    const conversationalPatterns = [
        /\b(yaar|bhai|dost|bro|sis)\b/i,
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
    // Long conversational/contextual sentence (4+ words) → Groq (context-aware)
    else if (wordCount >= 4 && (isConversational || isQuestion)) {
        recommendedTranslator = "groq";
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
        if (Native && typeof Native.translateWithGroq === "function") {
            nativeAvailable = true;
            console.log("[CCVibe] Native Groq module available!");
        } else {
            nativeAvailable = false;
            console.log("[CCVibe] Native module not available, Groq disabled");
        }
    } catch {
        nativeAvailable = false;
        console.log("[CCVibe] Native module check failed, Groq disabled");
    }

    return nativeAvailable;
}

/**
 * Translate using Groq AI via native module
 */
async function groqTranslate(text: string): Promise<string | null> {
    const apiKey = settings.store.groqApiKey;
    if (!apiKey) return null;

    try {
        const isAvailable = await checkNativeAvailable();
        if (!isAvailable) return null;

        const result = await Native.translateWithGroq(text, apiKey);

        if (result.success && result.translation) {
            if (isRealTranslation(text, result.translation)) {
                return result.translation;
            }
        } else if (result.error) {
            console.warn("[CCVibe] Groq error:", result.error);
        }

        return null;
    } catch (e) {
        console.error("[CCVibe] Groq translation failed:", e);
        return null;
    }
}

/**
 * Google Translate API (unfiltered, literal)
 */
async function googleTranslate(text: string, sourceLang: string): Promise<string | null> {
    const apiKey = settings.store.googleApiKey;
    if (!apiKey) return null;

    try {
        const url = "https://translate-pa.googleapis.com/v1/translate?" + new URLSearchParams({
            "params.client": "gtx",
            "dataTypes": "TRANSLATION",
            "key": apiKey,
            "query.sourceLanguage": sourceLang,
            "query.targetLanguage": "en",
            "query.text": text,
        });

        const res = await fetch(url);
        if (!res.ok) return null;

        const data = await res.json();
        return data.translation || null;
    } catch {
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
 * Try Google with multiple source languages
 */
async function tryGoogleTranslate(text: string): Promise<string | null> {
    // Try Hindi first
    let result = await googleTranslate(text, "hi");
    if (result && isRealTranslation(text, result)) {
        return result;
    }

    // Try Urdu
    result = await googleTranslate(text, "ur");
    if (result && isRealTranslation(text, result)) {
        return result;
    }

    // Try auto-detect
    result = await googleTranslate(text, "auto");
    if (result && isRealTranslation(text, result)) {
        return result;
    }

    return null;
}

/**
 * Translate a single word using cache -> dictionary -> Google
 */
async function translateWord(word: string): Promise<string> {
    const lowerWord = word.toLowerCase();

    // Check word cache
    if (wordCache.has(lowerWord)) {
        return wordCache.get(lowerWord)!;
    }

    // Check dictionary first for slang
    if (SLANG_DICTIONARY[lowerWord]) {
        const result = SLANG_DICTIONARY[lowerWord];
        wordCache.set(lowerWord, result);
        return result;
    }

    // Try Google for this word
    const googleResult = await tryGoogleTranslate(lowerWord);
    if (googleResult) {
        wordCache.set(lowerWord, googleResult);
        return googleResult;
    }

    // No translation, return original
    return word;
}

/**
 * Translate word-by-word with dictionary
 */
async function translateWordByWord(text: string): Promise<string> {
    const words = text.split(/(\s+)/);
    const translatedParts: string[] = [];

    for (const part of words) {
        if (/^\s+$/.test(part) || part.length <= 1 || /^[^a-zA-Z]+$/.test(part)) {
            translatedParts.push(part);
            continue;
        }
        const translated = await translateWord(part);
        translatedParts.push(translated);
    }

    return translatedParts.join("");
}

// =============================================================================
// MAIN TRANSLATION FUNCTION - Smart Routing
// =============================================================================

/**
 * Main translation function with smart routing
 */
export async function translateToEnglish(text: string): Promise<TranslationResult> {
    // Check cache
    const cached = translationCache.get(text);
    if (cached) return cached;

    const cacheAndReturn = (translated: string, source: string): TranslationResult => {
        const result: TranslationResult = { original: text, translated, sourceLanguage: source };
        if (translationCache.size >= MAX_CACHE_SIZE) {
            const firstKey = translationCache.keys().next().value;
            if (firstKey) translationCache.delete(firstKey);
        }
        translationCache.set(text, result);
        return result;
    };

    try {
        const startTime = Date.now();

        // Analyze sentence to determine best translator
        const analysis = analyzeSentence(text);
        console.log(`[CCVibe] Analysis: "${text}" → ${analysis.recommendedTranslator} (words:${analysis.wordCount}, profanity:${analysis.hasProfanity}, abbrev:${Math.round(analysis.abbreviationRatio * 100)}%)`);

        // Check if entire text is in dictionary
        const lowerText = text.toLowerCase().trim();
        if (SLANG_DICTIONARY[lowerText]) {
            console.log(`[CCVibe] Dictionary hit: "${text}" -> "${SLANG_DICTIONARY[lowerText]}"`);
            return cacheAndReturn(SLANG_DICTIONARY[lowerText], "dictionary");
        }

        let result: string | null = null;

        // Route based on analysis
        switch (analysis.recommendedTranslator) {
            case "dictionary":
                // Already checked above, fallthrough to google
                result = await tryGoogleTranslate(text);
                if (result) {
                    console.log(`[CCVibe] Google (${Date.now() - startTime}ms): "${text}" -> "${result}"`);
                    return cacheAndReturn(result, "google");
                }
                break;

            case "google":
                // Try Google first (unfiltered, literal)
                result = await tryGoogleTranslate(text);
                if (result) {
                    console.log(`[CCVibe] Google (${Date.now() - startTime}ms): "${text}" -> "${result}"`);
                    return cacheAndReturn(result, "google");
                }
                // Fallback to word-by-word for profanity (dictionary has the words)
                if (analysis.hasProfanity) {
                    const wordByWord = await translateWordByWord(text);
                    if (isRealTranslation(text, wordByWord)) {
                        console.log(`[CCVibe] Word-by-word profanity (${Date.now() - startTime}ms): "${text}" -> "${wordByWord}"`);
                        return cacheAndReturn(wordByWord, "word-by-word");
                    }
                }
                break;

            case "groq":
                // Try Groq for conversational/contextual sentences
                result = await groqTranslate(text);
                if (result) {
                    console.log(`[CCVibe] Groq (${Date.now() - startTime}ms): "${text}" -> "${result}"`);
                    return cacheAndReturn(result, "groq");
                }
                // Fallback to Google
                result = await tryGoogleTranslate(text);
                if (result) {
                    console.log(`[CCVibe] Google fallback (${Date.now() - startTime}ms): "${text}" -> "${result}"`);
                    return cacheAndReturn(result, "google");
                }
                break;

            case "word-by-word":
                // Heavy abbreviations - expand word by word
                const wordByWord = await translateWordByWord(text);
                if (isRealTranslation(text, wordByWord)) {
                    console.log(`[CCVibe] Word-by-word (${Date.now() - startTime}ms): "${text}" -> "${wordByWord}"`);
                    return cacheAndReturn(wordByWord, "word-by-word");
                }
                // Fallback to Google
                result = await tryGoogleTranslate(text);
                if (result) {
                    console.log(`[CCVibe] Google fallback (${Date.now() - startTime}ms): "${text}" -> "${result}"`);
                    return cacheAndReturn(result, "google");
                }
                break;
        }

        // Last resort: try everything
        result = await tryGoogleTranslate(text);
        if (result) {
            return cacheAndReturn(result, "google");
        }

        result = await groqTranslate(text);
        if (result) {
            return cacheAndReturn(result, "groq");
        }

        const finalWordByWord = await translateWordByWord(text);
        if (isRealTranslation(text, finalWordByWord)) {
            return cacheAndReturn(finalWordByWord, "word-by-word");
        }

        console.log(`[CCVibe] No translation for: "${text}"`);
        return { original: text, translated: text, sourceLanguage: "unchanged" };

    } catch (error) {
        console.error("[CCVibe] Translation error:", error);
        return { original: text, translated: text, sourceLanguage: "error" };
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export async function requestCspOverride(): Promise<boolean> {
    return await checkNativeAvailable();
}

export function clearCache(): void {
    translationCache.clear();
    wordCache.clear();
}

export function getCacheStats() {
    return { size: translationCache.size, maxSize: MAX_CACHE_SIZE };
}
