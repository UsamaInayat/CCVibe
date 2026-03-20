# CCVibe

Vencord plugin that auto-translates Romanized Hindi/Urdu messages to English inline in Discord.

## Project Structure

```
CCvibe/
  ccvibe/                     # Plugin source (all files go in Vencord/src/userplugins/ccvibe/)
    index.tsx                 # Main plugin entry - patches Discord message renderer
    settings.ts               # Plugin settings (enabled, showOriginalOnHover, API keys)
    detector.ts               # Language detection - regex patterns for Roman Hindi/Urdu
    translate.ts              # Smart routing translation engine (4 backends)
    native.ts                 # Electron native module for Groq API (bypasses CSP)
    TranslatedText.tsx        # Inline translated text React component
    TranslationAccessory.tsx  # Message accessory React component (below-message display)
    styles.css                # Styles using Discord CSS variables
  INSTALL.txt                 # User-facing installation guide
  API_KEYS_GUIDE.txt          # Guide for obtaining Google Translate & Groq API keys
  CLAUDE.md                   # This file - dev reference
```

## Tech Stack

- **Runtime**: Vencord (Discord client mod framework)
- **Language**: TypeScript + React (TSX)
- **APIs**: Google Translate API, Groq API (LLaMA 3.3 70B)
- **Build**: Vencord's build system (pnpm build)

## Architecture

### Translation Pipeline
1. Discord message renderer is patched via `index.tsx` to intercept content
2. `detector.ts` checks if text is Roman Hindi/Urdu (regex-based, 100+ patterns)
3. `translate.ts` analyzes the sentence and routes to the best translator:
   - **Dictionary**: single slang/profanity words (no API key needed)
   - **Google Translate**: short phrases, profanity fallback (needs Google API key)
   - **Groq AI**: conversational sentences 4+ words (needs Groq API key)
   - **Word-by-word**: abbreviation-heavy text >40% (no API key needed)
4. Results cached in-memory (max 500 entries)
5. `TranslatedText.tsx` renders inline with hover-to-show-original

### Key Patterns
- Plugin uses Vencord's `definePlugin` with `patches` array for runtime code injection
- Native module (`native.ts`) runs in Electron main process to bypass Discord's CSP
- Translation is async - text shows original until translation completes, then appears on next render
- Caching at two levels: full sentence cache and individual word cache
- API keys are stored in Vencord plugin settings (user-provided, not hardcoded)

## Development

### Build & Deploy
```bash
cd Vencord
pnpm build
```
After building, copy dist files to the Vencord Roaming directory:
```
Copy from:  Vencord\dist\renderer.js, patcher.js, preload.js (+ .map and .css)
Copy to:    %APPDATA%\Vencord\dist\
```
Then restart Discord.

### First-Time Setup
```bash
npm install -g pnpm
git clone https://github.com/Vendicated/Vencord.git
cd Vencord
pnpm install
```
Copy `ccvibe/` folder to `Vencord\src\userplugins\ccvibe\`, then build and inject:
```bash
pnpm build
pnpm inject        # or use the CLI directly for non-interactive:
dist\Installer\VencordInstallerCli.exe -install -branch stable
```

### Plugin Location
Place the `ccvibe/` folder at: `Vencord/src/userplugins/ccvibe/`

## Version History

### V2 (Current)
- **Removed hardcoded API keys** - users now enter their own keys in plugin settings
- **Added settings fields**: `googleApiKey` and `groqApiKey` in the CCVibe settings panel
- **Graceful fallback**: if a key is missing, that translator is skipped (dictionary + word-by-word always work)
- **Fixed broken patch**: updated regex from `hasSpoilerEmbeds:\i,content:` to `hasSpoilerEmbeds:\i,hasBailedAst:\i,content:` to match current Discord code
- **Added API_KEYS_GUIDE.txt** for end-user distribution

### V1
- Initial release with hardcoded API keys
- Inline replacement with hover-to-show-original
- Smart routing across 4 translation backends

## V1 → V2 Patch Details

Discord added `hasBailedAst` to the message renderer return object, breaking the V1 regex patch.

```diff
# index.tsx patch match regex
- match: /(?=return{hasSpoilerEmbeds:\i,content:(\i))/
+ match: /(?=return{hasSpoilerEmbeds:\i,hasBailedAst:\i,content:(\i))/
```

This regex must match FakeNitro's pattern in Vencord's source — if it breaks again in the future, check:
https://github.com/Vendicated/Vencord/blob/main/src/plugins/fakeNitro/index.tsx

## Distribution

### What to send friends (the CCvibe root folder):
```
CCvibe/
  ccvibe/              ← the plugin (8 files)
  INSTALL.txt          ← installation steps (Steps 1-6)
  API_KEYS_GUIDE.txt   ← how to get free API keys
```
Do NOT include `CLAUDE.md` when distributing.

### For friends upgrading from V1:
1. Replace the `ccvibe/` folder in `Vencord\src\userplugins\`
2. Run `pnpm build` in the Vencord folder
3. Restart Discord
4. Enter API keys in CCVibe plugin settings (Settings > Vencord > Plugins > CCVibe gear icon)

## Notes

- The plugin depends on Vencord's `MessageUpdaterAPI`
- Detection can produce false positives for short English words that overlap with Hindi/Urdu patterns
- The Vencord installer writes to `%APPDATA%\Vencord\dist\` — built files must be copied there, NOT just to the cloned repo's `dist/`
- The `pnpm inject` command requires interactive input; use the CLI directly with `-branch stable` flag for non-interactive injection
