# Repository Guidelines

## Project Structure & Module Organization
CryptoCoin is an Ionic + Angular application. Source code lives in `src/app`, where `app.component.*` defines the shell and feature folders such as `home/` hold Ionic pages. Shared assets (icons, fonts, localization files) belong in `src/assets`, and generated icons stay in `src/assets/icon`. Runtime configuration defaults sit in `src/environments/environment.ts`, with production overrides in `environment.prod.ts`. Global styling lives in `src/global.scss`, while tokens and theme variables belong in `src/theme`. Capacitor native projects are placed under `android/`; only touch them when shipping native changes and run `npx cap sync android` after web assets change. The `www/` directory is emitted by Angular builds and should remain unversioned.

## Build, Test, and Development Commands
Install dependencies with `npm install`. Use `npm run start` to launch the dev server with live reload at `http://localhost:8100`. `npm run build` produces an optimized bundle in `www/`; append `--configuration production` for release artifacts. Keep `npm run watch` running when integrating with native shells. Lint the codebase with `npm run lint`, and execute Karma/Jasmine unit tests via `npm run test`.

## Coding Style & Naming Conventions
Follow the Angular style guide: components, services, and guards use PascalCase filenames with the appropriate suffix (for example `home.page.ts`, `auth.service.ts`). Indentation is two spaces and single quotes are preferred, enforced by `.editorconfig` and `.eslintrc.json`. Co-locate SCSS next to its page component and lean on Ionic utility classes. Favor named exports and reserve default exports for Angular modules only.

## Encoding & Localization
Always save source files as UTF-8 (no BOM). On Windows PowerShell, pass "-Encoding utf8" when using "Set-Content"/"Out-File" and prefer editors configured for UTF-8.
If you edit strings with Portuguese accents or other non-ASCII text, verify with: python -c "import pathlib; pathlib.Path('file.ts').read_text(encoding='utf-8')" or search for the Unicode replacement character (U+FFFD) before committing.

## Testing Guidelines
Place unit specs adjacent to implementation files as `*.spec.ts`. Describe suites with the feature under test, e.g. `describe('HomePage', ...)`, and keep expectations behavior-focused. Running `npm run test` executes the entire suite; add `--code-coverage` before release to ensure `karma-coverage` reports stay stable. Mock Capacitor plugins in tests so they run reliably in browser-driven environments.

## Commit & Pull Request Guidelines
Write short, imperative commit subjects such as `Add NFC encryption flow` or `Update payout copy`, and reference issue IDs in the body when relevant. Pull requests should link their issue, describe UI changes, and add before/after screenshots for Ionic screens. Confirm linting and tests pass locally, and note any `npx cap sync android` runs when native projects change.
