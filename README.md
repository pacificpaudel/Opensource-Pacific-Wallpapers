# pacificwallpapers

## AI photo location

The photo details at the bottom of the new tab page include an AI location lookup. Add an OpenRouter API key, a Google Gemini API key, or both in Wallpaper Settings. OpenRouter is tried first; Gemini is used if OpenRouter is not configured, fails, or cannot identify the place. The extension sends the current wallpaper image to the configured AI service for analysis; place names and coordinates are cached locally for up to 50 images. The map pin opens a satellite view centered on the identified coordinates. API keys are stored in this browser's local extension storage and are not synced.

AI location results are estimates based on recognizable landmarks or geography. The lookup reports when it cannot identify a place confidently.

## License

This project is distributed under the custom Pacific Wallpapers Source-Available License in [LICENSE](./LICENSE). It permits personal and commercial use and redistribution of unmodified copies with attribution. Private modifications are allowed, but modified versions may not be distributed. This custom license is not an OSI-approved open-source license.