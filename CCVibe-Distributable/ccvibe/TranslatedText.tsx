/*
 * CCVibe - Auto-translate Roman Hindi/Urdu to English
 * Inline translated text component with hover-to-show-original
 */

import { useEffect, useState } from "@webpack/common";

import { getCachedTranslation, translateToEnglish } from "./translate";

interface TranslatedTextProps {
    original: string;
    language: "hi-ur" | "id";
    showOriginalOnHover: boolean;
}

export function TranslatedText({ original, language, showOriginalOnHover }: TranslatedTextProps) {
    const [translated, setTranslated] = useState<string | null>(() => getCachedTranslation(original));
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        const cached = getCachedTranslation(original);
        if (cached) {
            setTranslated(cached);
            return;
        }

        let cancelled = false;
        translateToEnglish(original, language).then(result => {
            if (!cancelled && result.translated !== result.original) {
                setTranslated(result.translated);
            }
        }).catch(e => {
            console.error("[CCVibe] Translation failed:", e);
        });

        return () => {
            cancelled = true;
        };
    }, [original, language]);

    if (!translated) {
        return <>{original}</>;
    }

    const displayText = showOriginalOnHover && isHovering ? original : translated;

    return (
        <span
            className="ccvibe-inline"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            title={showOriginalOnHover ? (isHovering ? "Translated text" : `Original: ${original}`) : undefined}
        >
            {displayText}
            <span className="ccvibe-indicator">
                {isHovering ? " (original)" : " (translated)"}
            </span>
        </span>
    );
}
