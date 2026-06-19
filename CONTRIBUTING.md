# Contributing to System App Nuker

## Adding App Categories

Thanks for helping keep the app list accurate and up-to-date!

Edit [webui/src/data/category.ts](webui/src/data/category.ts) — add the package name to the appropriate array:

```ts
export const essential: string[] = [
  "com.android.settings",   // ← existing entry, example
  "com.example.newapp",     // ← your addition
];
```

Pick the right array name: `essential`, `caution`, `safe`, `google`, or `unknown`.

### Tips

- Search the file to avoid duplicates
- Describe your additions in the PR description

---

## WebUI Development

The WebUI is a [Vite](https://vite.dev) + [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org/) project in [webui/](webui/).

### Setup

```bash
cd webui
pnpm install --frozen-lockfile
```

### Dev server (local browser)

```bash
pnpm dev
```

Opens a hot-reload dev server — the WebUI runs entirely in the browser. No device needed for UI work.

### Production build

```bash
pnpm build
```

Output goes to `module/webroot/`. Always run `pnpm build` before submitting frontend changes.

### Project structure

```
webui/
├── src/
│   ├── components/       # Reusable UI components
│   │   └── dialog/       # Dialog components
│   ├── data/
│   │   ├── category.ts   # App categories
│   │   ├── config.ts     # Mirrors module/config.sh (see below)
│   │   └── i18n/         # Translation files
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Core logic (CLI bridge, app list handling, file ops)
│   ├── pages/            # Route pages (Home, Restore, Settings, Whiteout)
│   ├── assets/           # Icons
│   ├── main.tsx          # Entry point
│   └── theme.css         # Design tokens
├── index.html
├── vite.config.ts
└── package.json
```

### Config mapping

[webui/src/data/config.ts](webui/src/data/config.ts) mirrors [module/config.sh](module/config.sh). Keys and default values are kept in sync between both files. When adding a new config option:
1. Add the variable with its default to `module/config.sh`
2. Add the corresponding entry to `webui/src/data/config.ts`

### Adding a translation

1. Create a new file in [webui/src/data/i18n/](webui/src/data/i18n/), e.g. `zh.ts`
2. Copy the structure from [webui/src/data/i18n/en.ts](webui/src/data/i18n/en.ts) and translate the values
3. Register it in [webui/src/lib/i18n.ts](webui/src/lib/i18n.ts):

```ts
import zh from '../data/i18n/zh'

resources: {
  en: { translation: en },
  zh: { translation: zh },  // ← add
}
```

---

## Code Contributions

- Use clear variable names
- Comment complex operations

---

## How to Submit Changes

1. Fork the repository.
2. Create a new branch.
3. Make your changes:
   - **WebUI frontend** → files under [webui/src/](webui/src/)
   - **Module scripts** → files under [module/](module/)
4. Submit a pull request.

---

## Reporting Issues

Include:
- Device model
- Android version
- Root solution and version (Magisk/KernelSU/Apatch)
- Steps to reproduce
- Any error messages
