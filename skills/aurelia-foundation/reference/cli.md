<!-- Adapted from aurelia/skills (MIT) `references/cli.md`; canonical source aurelia/aurelia. -->

# `npx makes aurelia` — Project Generator

The official Aurelia 2 scaffolder is the `makes` skeleton at `aurelia-new`. Run it with
`npx makes aurelia`. It composes a project from feature fragments.

This is the deeper form of the `npx makes aurelia my-app` step in
[quickstart.md](quickstart.md) — reach for it when you need non-interactive generation or specific
feature flags.

## Non-interactive generation

Pass features with `-s` (silent select), comma-separated, no spaces:

```bash
npx makes aurelia <project-name> -s feature1,feature2,feature3
```

You only need to list the features you care about. **Unspecified groups fall back to defaults**
(an `app`, `latest`, `vite`, `typescript`, plain-`css` project). So a short selection like the one
below yields a working Vite + TypeScript app with the extras you named:

```bash
npx makes aurelia my-app -s tailwindcss,vitest,playwright,storybook,app-with-router
```

Omit `-s` entirely to run the interactive wizard with quick-pick presets instead.

## Feature groups and values

Each group is a single choice unless noted. The first value listed is the default when the group is
not passed in `-s`.

| Group | Values | Notes |
|-------|--------|-------|
| Project type | `app`, `plugin` | default `app` |
| Release | `latest`, `dev` | `dev` = nightly |
| Bundler | `vite`, `webpack`, `dumber`, `parcel` | default `vite`; `dumber`/`parcel` are app-only |
| Transpiler | `typescript`, `babel` | default `typescript` |
| CSS scoping (optional) | `shadow-dom`, `css-module` | omit for none; mutually exclusive |
| CSS preprocessor | `css`, `sass`, `tailwindcss` | default plain `css` |
| Unit tests | `no-unit-tests`, `jest`, `vitest` | `vitest` requires `vite`; `jest` requires a non-Vite bundler |
| E2E (optional) | `playwright` | app-only; omit for none |
| Storybook (optional) | `storybook` | requires `vite` or `webpack`; omit for none |
| Sample code | `app-blank`, `app-min`, `app-with-router`, `plugin-min` | must match project type |
| Browsers | `browser-evergreen` | currently the only target |

Conditional rules (enforced by the generator's `if:` guards):

- `vitest` only with `vite`; `jest` only with `webpack`/`dumber`/`parcel`.
- `dumber`, `parcel`, and `playwright` are available for `app` projects only.
- `storybook` only with `vite` or `webpack`.
- Sample code must match the project type (`app-*` for apps, `plugin-min` for plugins).
- `shadow-dom` and `css-module` cannot both be selected.

## Example commands

```bash
# Minimal TypeScript + Vite, no tests, blank shell
npx makes aurelia my-app -s app,vite,typescript,no-unit-tests,app-blank

# TypeScript + Vite + Vitest, hello-world starter
npx makes aurelia my-app -s vitest,app-min

# Full app: Vite + Tailwind + Vitest + Playwright + Storybook + routing
npx makes aurelia my-app -s tailwindcss,vitest,playwright,storybook,app-with-router

# Webpack + TypeScript + Jest + Sass
npx makes aurelia my-app -s webpack,typescript,jest,sass,app-min

# Plugin project: Vite + TypeScript + Shadow DOM
npx makes aurelia my-plugin -s plugin,typescript,vitest,shadow-dom,plugin-min
```

## Generated structure (TypeScript + Vite)

```
my-app/
├── src/
│   ├── main.ts          # bootstrap (Aurelia.register(...).app(MyApp).start())
│   ├── my-app.ts        # root component
│   ├── my-app.html      # root template
│   └── resource.d.ts    # .html/.css module typings
├── test/                # unit tests + setup (if vitest/jest)
├── e2e/                 # Playwright tests (if playwright)
├── .storybook/          # config (if storybook)
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

`package.json` scripts: `npm start` (dev server), `npm run build`, `npm test`, `npm run test:e2e`
(if Playwright), `npm run storybook` (if Storybook). Script names vary slightly per bundler.

## Gotchas

- Requires Node.js 18+.
- In silent (`-s`) mode the generator does **not** install dependencies — run `npm install`
  yourself afterward.
- If you selected Playwright, also run `npx playwright install --with-deps`.
- After scaffolding, strip out demo/sample data before building the real app, and prune any selected
  tooling the app does not actually use.
- Do not add Tailwind, Storybook, Playwright, or Vitest unless the user asked for them or the repo
  already uses them — every dependency must be justified by an actual app need.

## Where to go next

| Need | Reference |
|---|---|
| The minimum hello-world path | [quickstart.md](quickstart.md) |
| Component testing with Vitest + `@aurelia/testing` | `aurelia-ecosystem/reference/testing.md` |
