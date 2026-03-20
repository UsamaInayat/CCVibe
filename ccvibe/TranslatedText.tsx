/*
 * CCVibe - Auto-translate Roman Hindi/Urdu to English
 * Inline translated text component with hover-to-show-original
 */

import { useState } from "@webpack/common";

interface TranslatedTextProps {
    original: string;
    translated: string;
    showOriginalOnHover: boolean;
}

export function TranslatedText({ original, translated, showOriginalOnHover }: TranslatedTextProps) {
    const [isHovering, setIsHovering] = useState(false);

    // Determine what text to show
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
