/*
 * CCVibe - Auto-translate Roman Hindi/Urdu to English
 * Language detection for Romanized Hindi/Urdu
 */

// Common Roman Hindi/Urdu words and patterns
const HINDI_URDU_PATTERNS = [
    // Question words
    /\b(kya|kaise|kaisa|kyun|kyu|kab|kahan|kon|kitna|kitne|kitni)\b/i,

    // Verbs - to be
    /\b(hai|hain|ho|hun|tha|thi|the|hoga|hogi|hoge|hona|h)\b/i,

    // Pronouns
    /\b(mein|main|mujhe|mera|meri|mere|tum|tumhe|tumhara|tumhari|tumhare)\b/i,
    /\b(aap|aapka|aapki|aapke|unka|unki|unke|uska|uski|uske|hum|humara)\b/i,
    /\b(yeh|ye|woh|wo|is|us|isko|usko|inhe|unhe|yhi|yehi|yahi|whi|wohi|wahi)\b/i,

    // Common chat abbreviations (very common in Roman Urdu/Hindi texting)
    /\b(bhi|v)\b/i,             // bhi (also)
    /\b(pe|pr|par)\b/i,         // par/pe (on/at)
    /\b(ka|ki|ke|ko)\b/i,       // ka/ki/ke/ko (of/to)
    /\b(mje|mjhe)\b/i,          // mujhe abbreviated
    /\b(hy|hen)\b/i,            // hai abbreviated
    /\b(rha|rhi|rhe)\b/i,       // raha/rahi abbreviated
    /\b(nhi|ni)\b/i,            // nahi abbreviated
    /\b(sy|se)\b/i,             // se (from/with)

    // Issue/problem related words (common in chat)
    /\b(issue|masla|problem)\b/i,

    // More demonstratives and emphatics
    /\b(isi|usi|isne|usne|inhone|unhone)\b/i,
    /\b(yahan|wahan|idhar|udhar)\b/i,

    // Common borrowed words used in Roman Urdu/Hindi context
    /\b(pass|paas)\b/i,         // near/have
    /\b(sahi|galat)\b/i,        // right/wrong
    /\b(scene|seen)\b/i,        // scene (commonly used)
    /\b(time|tym)\b/i,          // time

    // Common verbs
    /\b(kar|karo|karna|karta|karti|karte|karke|karenge|karunga|karungi|kiya|kiye)\b/i,
    /\b(bol|bolo|bolna|bolta|bolti|bolte|bola|boli|bole)\b/i,
    /\b(bata|batao|batana|bataya|batayi|bataye)\b/i,
    /\b(ja|jao|jana|jata|jati|jate|gaya|gayi|gaye|jayega|jayegi)\b/i,
    /\b(aa|aao|aana|aata|aati|aate|aaya|aayi|aaye|aayega|aayegi)\b/i,
    /\b(de|do|dena|deta|deti|dete|diya|diye|dega|degi)\b/i,
    /\b(le|lo|lena|leta|leti|lete|liya|liye|lega|legi)\b/i,
    /\b(dekh|dekho|dekhna|dekha|dekhi|dekhe|dekhega|dekhegi)\b/i,
    /\b(sun|suno|sunna|suna|suni|sune|sunega|sunegi)\b/i,
    /\b(samajh|samjho|samajhna|samjha|samjhi|samjhe)\b/i,
    /\b(ruk|ruko|rukna|ruka|ruki|ruke)\b/i,
    /\b(chal|chalo|chalna|chala|chali|chale|chalega|chalegi)\b/i,
    /\b(soch|socho|sochna|socha|sochi|soche)\b/i,
    /\b(mil|milo|milna|mila|mili|mile|milega|milegi)\b/i,
    /\b(pata|pati|patna)\b/i,
    /\b(lag|laga|lagi|lage|lagta|lagti|lagte)\b/i,
    /\b(reh|reho|rehna|reha|rehi|rehe|rehega|rahega|rahna)\b/i,
    /\b(ban|bano|banna|bana|bani|bane|banega|banegi)\b/i,
    /\b(khel|khelo|khelna|khela|kheli|khele)\b/i,
    /\b(padh|padho|padhna|padha|padhi|padhe)\b/i,
    /\b(likh|likho|likhna|likha|likhi|likhe)\b/i,

    // Negation
    /\b(nahi|nahin|nai|mat|na)\b/i,

    // Adjectives/Adverbs
    /\b(acha|accha|acchi|acche|theek|thik|sahi|galat)\b/i,
    /\b(bahut|bohot|boht|zyada|jyada|kam|thoda|thodi|thode)\b/i,
    /\b(abhi|phir|fir|baad|pehle|pahle|bad)\b/i,
    /\b(aaj|kal|parso|parsoo)\b/i,
    /\b(bada|badi|bade|chota|choti|chote)\b/i,
    /\b(naya|nayi|naye|purana|purani|purane)\b/i,

    // Social words
    /\b(yaar|bhai|behen|dost|log|jan)\b/i,
    /\b(beta|beti|bacha|bache)\b/i,

    // Quantifiers/Pronouns
    /\b(kuch|sab|sabhi|koi|kaun|har|hamesha)\b/i,

    // Conjunctions
    /\b(aur|ya|lekin|par|magar|kyunki|kyuki|isliye|toh|to)\b/i,

    // Greetings
    /\b(salam|namaste|namaskar|adaab)\b/i,
    /\b(khuda\s*hafiz|allah\s*hafiz|alvida|bye)\b/i,
    /\b(shukriya|dhanyavad|thanks)\b/i,

    // Common expressions
    /\b(kaise\s*ho|kaisa\s*hai|kya\s*haal|kya\s*huwa|kya\s*hua)\b/i,
    /\b(theek\s*hai|thik\s*hai|sahi\s*hai)\b/i,
    /\b(pata\s*nahi|nahi\s*pata|maloom\s*nahi)\b/i,
    /\b(koi\s*baat\s*nahi|koi\s*nai)\b/i,
    /\b(chalo|chaliye|chal)\b/i,

    // Time expressions
    /\b(subah|dopahar|shaam|raat)\b/i,

    // Common nouns
    /\b(ghar|kamra|room|jagah|dukan|school|college)\b/i,
    /\b(kaam|paisa|paise|cheez|cheezein|baat|baatein)\b/i,
    /\b(khana|paani|chai|doodh)\b/i,
    /\b(sar|haath|pair|aankh|muh|kan)\b/i,

    // Modal/Auxiliary
    /\b(sakta|sakti|sakte|chahiye|chahte|chahta|chahti)\b/i,
    /\b(wala|wali|wale)\b/i,
];

// Words that are definitely English (avoid false positives)
const ENGLISH_INDICATORS = [
    /\b(the|and|but|for|are|was|were|been|being|have|has|had)\b/i,
    /\b(this|that|these|those|which|where|when|what|who|how|why)\b/i,
    /\b(with|from|into|about|over|under|between|through)\b/i,
    /\b(would|could|should|might|must|will|shall|can|may)\b/i,
    /\b(because|although|however|therefore|since)\b/i,
    /\b(their|there|they|them|your|you|our|we)\b/i,
    /\b(just|also|very|really|actually|basically)\b/i,
];

/**
 * Detects if a message is likely Roman Hindi/Urdu
 * @param text The message text to analyze
 * @returns true if the message appears to be Roman Hindi/Urdu
 */
export function isLikelyHindiUrdu(text: string): boolean {
    // Skip very short messages
    if (text.length < 4) return false;

    // Skip if it looks like a URL, command, or code
    if (/^https?:\/\//.test(text)) return false;
    if (/^[\/!\.]\w+/.test(text)) return false;
    if (/^```/.test(text)) return false;

    // Count Hindi/Urdu pattern matches
    let hindiMatches = 0;
    for (const pattern of HINDI_URDU_PATTERNS) {
        if (pattern.test(text)) {
            hindiMatches++;
        }
    }

    // Count English indicator matches
    let englishMatches = 0;
    for (const pattern of ENGLISH_INDICATORS) {
        if (pattern.test(text)) {
            englishMatches++;
        }
    }

    // Decision logic:
    // - Need at least 1 Hindi/Urdu match
    // - Hindi matches should outweigh English matches
    // - For very short messages, require stronger signals
    const wordCount = text.split(/\s+/).length;

    // Debug logging (can be removed later)
    if (hindiMatches > 0) {
        console.log(`[CCVibe] Detection: "${text}" - Hindi:${hindiMatches} English:${englishMatches} Words:${wordCount}`);
    }

    if (wordCount <= 3) {
        // Short messages: need at least 1 match and no strong English
        return hindiMatches >= 1 && englishMatches === 0;
    } else if (wordCount <= 6) {
        // Medium messages: need at least 1 match and more Hindi than English
        return hindiMatches >= 1 && hindiMatches > englishMatches;
    } else {
        // Longer messages: need good ratio
        return hindiMatches >= 1 && hindiMatches >= englishMatches;
    }
}
