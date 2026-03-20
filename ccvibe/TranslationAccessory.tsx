/*
 * CCVibe - Auto-translate Roman Hindi/Urdu to English
 * Translation accessory component shown below messages
 */

import { classNameFactory } from "@api/Styles";
import { Message } from "@vencord/discord-types";
import { useEffect, useState } from "@webpack/common";

import { isLikelyHindiUrdu } from "./detector";
import { settings } from "./settings";
import { translateToEnglish, TranslationResult } from "./translate";

const cl = classNameFactory("ccvibe-");

// SVG icon for translate
function TranslateIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
        >
            <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
        </svg>
    );
}

interface TranslationAccessoryProps {
    message: Message;
}

export function TranslationAccessory({ message }: TranslationAccessoryProps) {
    const [translation, setTranslation] = useState<TranslationResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Skip if plugin is disabled
        if (!settings.store.enabled) return;

        // Skip if no content
        if (!message.content) return;

        // Skip embedded messages
        if ((message as any).vencordEmbeddedBy) return;

        // Check if message is likely Hindi/Urdu
        if (!isLikelyHindiUrdu(message.content)) return;

        // Start translation
        setIsLoading(true);
        setError(null);

        translateToEnglish(message.content)
            .then(result => {
                // Only show if translation is different from original
                if (result.translated !== result.original) {
                    setTranslation(result);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error("[CCVibe] Translation failed:", err);
                setError("Translation failed");
                setIsLoading(false);
            });
    }, [message.content, message.id]);

    // Don't render if dismissed
    if (dismissed) return null;

    // Don't render if still loading (to avoid flicker)
    if (isLoading) return null;

    // Don't render if error (fail silently)
    if (error) return null;

    // Don't render if no translation
    if (!translation) return null;

    // Don't render if translation is same as original
    if (translation.translated === translation.original) return null;

    return (
        <div className={cl("accessory")}>
            <TranslateIcon className={cl("icon")} />
            <span className={cl("text")}>
                {translation.translated}
                {settings.store.showOriginalOnHover && (
                    <>
                        <br />
                        <span className={cl("original")}>
                            Original: {translation.original}
                        </span>
                    </>
                )}
            </span>
            <button
                className={cl("dismiss")}
                onClick={() => setDismissed(true)}
            >
                Dismiss
            </button>
        </div>
    );
}
