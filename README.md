# pacificwallpapers

## AI photo location

The photo details at the bottom of the new tab page include separate OpenRouter and Google Gemini location lookups. Add either or both API keys in Wallpaper Settings; each provider runs independently and displays its own result and map pin. Gemini uses the Pro model and a larger image for place identification. Before calling an AI provider, the extension checks the public, read-only [`location-cache.json`](./location-cache.json) in this repository using a SHA-256 hash of the image bytes. Shared-cache hits are highlighted light yellow; browser-local cached results are also highlighted. New results are saved in this browser's local extension storage (up to 50 provider results), not written back to GitHub. To add shared results, update the JSON file in the repository. Its image hashes and location results are public. API keys are stored in this browser's local extension storage and are not synced. Each uncached lookup may incur a charge from its provider.

Each shared cache entry has this shape: `{"imageHash":"<64-character lowercase SHA-256 of the image bytes>","provider":"gemini","place":"Place, Country","latitude":0,"longitude":0}`. Use `openRouter` or `gemini` for `provider`; keep `version` set to `1`.

AI location results are estimates based on recognizable landmarks or geography. The lookup reports when it cannot identify a place confidently.

## License

This project is distributed under the custom Pacific Wallpapers Source-Available License in [LICENSE](./LICENSE). It permits personal and commercial use and redistribution of unmodified copies with attribution. Private modifications are allowed, but modified versions may not be distributed. This custom license is not an OSI-approved open-source license.