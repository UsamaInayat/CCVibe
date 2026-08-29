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

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

export function TranslatedText({ original, language, showOriginalOnHover }: TranslatedTextProps) {
    const [translated, setTranslated] = useState<string | null>(() => getCachedTranslation(original));
    const [isLoading, setIsLoading] = useState(() => !getCachedTranslation(original));
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        const cached = getCachedTranslation(original);
        if (cached) {
            setTranslated(cached);
            setIsLoading(false);
            return;
        }

        let cancelled = false;
        let retryCount = 0;

        const run = () => {
            setIsLoading(true);
            translateToEnglish(original, language).then(result => {
                if (cancelled) return;

                if (result.translated !== result.original) {
                    setTranslated(result.translated);
                    setIsLoading(false);
                    return;
                }

                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    setTimeout(run, RETRY_DELAY_MS);
                    return;
                }

                setIsLoading(false);
            }).catch(e => {
                if (cancelled) return;
                console.error("[CCVibe] Translation failed:", e);

                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    setTimeout(run, RETRY_DELAY_MS);
                    return;
                }

                setIsLoading(false);
            });
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [original, language]);

    if (!translated) {
        return (
            <span className={isLoading ? "ccvibe-inline ccvibe-loading" : undefined}>
                {original}
                {isLoading && <span className="ccvibe-indicator"> (translating…)</span>}
            </span>
        );
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
