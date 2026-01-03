# Contributing to ESPConnect

Thank you for your interest in contributing to ESPConnect!

## Quick rules
- Please open a Pull Request against `main` (direct pushes to `main` are disabled).
- Keep PRs focused (one feature/fix per PR if possible).
- Make sure CI passes.

## Development
>Prerequisite: Node.js **>= 22.12.0**.
```bash
git clone https://github.com/thelastoutpostworkshop/ESPConnect.git
cd ESPConnect
npm install
npm run dev
```

## Code style
- Run typecheck: `npm run typecheck`

## E2E tests
- Install Playwright browsers (first time only): `npx playwright install`
- Run E2E tests: `npm run test:e2e`
- The E2E runner starts Vite with `VITE_E2E=1` and aliases the WebSerial service layer to a mock (`src/services/esptoolClient.mock.ts`).
- You can also open the app with `?e2e=1` to force the E2E path locally when running `npm run dev`.
- Unit tests live under `src/tests` and use Vitest; keep those there.

## Translations (i18n)
- Keep strings consistent with existing keys.
- Avoid changing formatting/whitespace unless required.
- Please do not translate technical terms unless the UI already does so consistently.
- Preserve placeholders exactly (e.g. `{fs}`, `{language}`, `{count}`) so the interpolation tokens remain valid across locales.
- When contributing a new language:
  1. Create a locale file under `src/locales/` (e.g. `fr.ts`) mirroring the structure in `en.ts` and translate each string section (`app`, `navigation`, `deviceInfo`, etc.).
  2. Import and register the new locale within `src/plugins/i18n.ts`, include the corresponding Vuetify bundle under `$vuetify`, and extend `supportedLocales` so it can be selected at runtime.
  3. Ensure the English `language` block lists the language name, and provide a translation for that entry inside your locale so the menu can display it correctly.
