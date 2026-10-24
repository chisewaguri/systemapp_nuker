# Contributing to System App Nuker

## App descriptions and removal levels

System App Nuker uses [UAD-ng's app list](https://github.com/Universal-Debloater-Alliance/universal-android-debloater-next-generation) for descriptions and removal levels. Submit package additions, description fixes and removal-level changes upstream to UAD-ng, not to this repository. There is no local `category.ts` list anymore.

The WebUI shows UAD-ng's recommended, advanced, expert and unsafe levels. Missing packages or unrecognized levels appear as unknown. These labels are guidance, not a guarantee that removing an app is safe on every device.

For problems with how System App Nuker loads or displays the list, open an issue here. Include the package name and what looks wrong.

### Working on the UAD-ng integration

- [webui/src/lib/uad.ts](webui/src/lib/uad.ts) loads the list and maps removal levels.
- [webui/scripts/fetch-uad.cjs](webui/scripts/fetch-uad.cjs) downloads and trims the upstream list into `webui/public/uad.json` for bundling.
- The WebUI prefers the copy downloaded through Settings, then the bundled copy. If neither is available, every app appears as unknown.

To include the bundled list in a local build, run this from `webui/` before building:

```bash
node scripts/fetch-uad.cjs
```

Do not edit or commit the generated `webui/public/uad.json`. CI fetches it before building. Release builds require the download to succeed. Other CI builds can continue without it.

## WebUI development

The [webui/](webui/) directory contains the Vite, React and TypeScript frontend.

```bash
cd webui
pnpm install --frozen-lockfile
pnpm dev
```

The dev server uses mock device data for browser-based UI work. It does not test root commands, mounting or installation.

Before submitting frontend changes, run:

```bash
pnpm lint
pnpm test
pnpm build
```

The build writes to `module/webroot/`. Do not commit the generated output.

### Config options

[webui/src/data/config.ts](webui/src/data/config.ts) mirrors [module/config.sh](module/config.sh). When adding an option, add its default to both files, add its labels to [webui/src/data/i18n/en.ts](webui/src/data/i18n/en.ts), and check that [module/customize.sh](module/customize.sh) preserves existing settings during updates.

### Translations

Copy [webui/src/data/i18n/en.ts](webui/src/data/i18n/en.ts) into a new language file and translate its values. Register it in [webui/src/lib/i18n.ts](webui/src/lib/i18n.ts). The current language is set there with `lng`.

## Module scripts

Module scripts live in [module/](module/). Check them from the repository root:

```bash
shellcheck -s sh -S error module/*.sh module/dummy_zip/customize.sh
```

The WebUI test suite also exercises module scripts with simulated package-manager and filesystem operations. Real mounting, whiteouts and root-manager installation still need device testing. State which checks you ran and which device behavior you could not test.

## Submitting changes

Fork the repository, create a branch and submit a pull request. Explain what changes and how you tested it. Keep unrelated changes separate.

For bugs, use the issue template and include reproduction steps, your module and root-manager versions, your Android version and device, and any relevant logs or screenshots.
