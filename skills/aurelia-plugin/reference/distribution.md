# Distribution — `package.json`, dual builds, and template/style shipping

A published plugin is an npm package whose `package.json` declares `aurelia` as a peerDependency, ships dual ESM + CJS + type declarations, and uses explicit `?raw` template imports instead of bundler conventions. This reference covers the canonical package tree, the full `package.json`, the hard line between convention-based and explicit-import templates, styling strategies, and the `types/assets.d.ts` shim.

## Canonical package tree

```text
my-plugin/
├── src/
│   ├── index.ts                    ← aggregate export (Plugin + individual classes)
│   ├── configuration.ts            ← createConfiguration, IMyPluginOptions, .customize()
│   ├── mp-button/
│   │   ├── mp-button.ts            ← @customElement({ name, template })
│   │   ├── mp-button.html
│   │   └── mp-button.css
│   ├── mp-card/
│   │   ├── mp-card.ts
│   │   └── mp-card.html
│   └── services/
│       └── translation-loader.ts
├── dist/                           ← build output (ESM + CJS + .d.ts)
│   ├── esm/
│   └── cjs/
├── types/
│   └── assets.d.ts                 ← module declarations for *.html, *.css, *.module.css
├── package.json
├── tsconfig.json
└── README.md
```

## The `?raw` import line — app convention vs npm contract

This is the single most important distribution rule. Inside a single app, Aurelia's Vite plugin pairs `name.ts` with `name.html` by convention — you write `@customElement('mp-button')` and the plugin finds the sibling `.html` file. **This convention does not survive npm publication.** The consumer's bundler does not know to look for a sibling `.html` next to a `.ts` inside `node_modules/my-plugin/`. The template must be imported explicitly as a string:

```ts
// FORBIDDEN in a published package — convention-based pairing
@customElement('mp-button')
export class MpButton {}

// CORRECT in a published package — explicit import + template field
import template from './mp-button.html?raw';
import styles from './mp-button.css?raw';

@customElement({ name: 'mp-button', template })
export class MpButton {}
```

The `?raw` suffix tells Vite (and compatible bundlers) to import the file's contents as a string. The string is then passed as the `template` field on the `@customElement` options.

## Full `package.json`

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "A distributable Aurelia v2 plugin.",
  "license": "MIT",
  "type": "module",
  "main": "dist/cjs/index.js",
  "module": "dist/esm/index.js",
  "types": "dist/esm/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/esm/index.d.ts",
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "peerDependencies": {
    "aurelia": "^2.0.0"
  },
  "sideEffects": false,
  "scripts": {
    "build": "tsc -p tsconfig.build.json && tsc -p tsconfig.build.cjs.json"
  }
}
```

Key fields:

- **`peerDependencies.aurelia`** — never `dependencies.aurelia`. The consumer's app provides the framework; the plugin consumes it. Bundling Aurelia as a runtime dependency ships a second copy of the DI container and template compiler.
- **`exports` condition map** — resolves `.` (the package root) to ESM for `import`, CJS for `require`, and `.d.ts` for `types`. Consumers on ESM get tree-shakeable ESM; consumers on CJS get interop.
- **`files: ["dist"]`** — ships only build output. Source maps and `.ts` files stay out of the tarball.
- **`sideEffects: false`** — tells the consumer's bundler that importing from the package is tree-shakeable. Set to `true` only if the plugin has global side effects on import (rare; prefer explicit registration).

## Template/style handling for distributed plugins

### Templates — always explicit `?raw`

```ts
import template from './mp-button.html?raw';

@customElement({ name: 'mp-button', template })
export class MpButton {
  @bindable public variant: string = 'primary';
}
```

### Three styling strategies

**1. Light DOM — global CSS import.** The plugin ships a CSS file; the consumer imports it once in their `main.ts`. This is the simplest strategy and matches `aurelia-component-library`'s Light DOM default.

```ts
// mp-button.ts — component does NOT import its own CSS
@customElement({ name: 'mp-button', template })
export class MpButton {}
```

```css
/* dist/styles.css — consumer imports this */
mp-button { display: inline-flex; }
```

```ts
// consumer's main.ts
import 'my-plugin/dist/styles.css';
```

**2. Shadow DOM — `shadowOptions` + `processStyles` (shadowCSS).** The plugin encapsulates styles inside the shadow root. The template references styles via the `processStyles` hook or the `containerless`/`useShadowDOM` decorator, and the CSS string is bundled into the JS so the consumer imports nothing extra.

```ts
import template from './mp-button.html?raw';
import styles from './mp-button.css?raw';

@customElement({ name: 'mp-button', template, shadowOptions: { mode: 'open' } })
export class MpButton {
  public static get shadowStyles(): string {
    return styles;
  }
}
```

**3. CSS Modules — `processStyles` returning a class-map.** The plugin uses CSS Modules so class names are scoped at build time. The imported object maps local names to hashed names.

```ts
import template from './mp-button.html?raw';
import styles from './mp-button.module.css';

@customElement({ name: 'mp-button', template })
export class MpButton {
  public readonly classes: Record<string, string> = styles;
}
```

The template references `$classes.button` instead of a literal class name.

### The required `types/assets.d.ts`

TypeScript does not know about `?raw` imports or `.module.css` exports. Ship a declaration file so the consumer's `tsc` (and the plugin's own build) compiles cleanly:

```ts
// types/assets.d.ts
declare module '*.html' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
```

Reference this file in `tsconfig.json` via `"include": ["src", "types"]`.

## The UI-library entry-point pattern

A plugin that ships a set of UI components exports both the aggregate `Plugin` object (for `Aurelia.register(...)`) and the individual classes (for tree-shaking). This dual export lets the consumer choose:

```ts
// src/index.ts
import { createConfiguration } from './configuration';
import { MpButton } from './mp-button/mp-button';
import { MpCard } from './mp-card/mp-card';
import type { MyPluginOptions } from './configuration';

export { MpButton } from './mp-button/mp-button';
export type { ButtonVariant } from './mp-button/mp-button';
export { MpCard } from './mp-card/mp-card';

export const MyPlugin = createConfiguration(null);
export type { MyPluginOptions };
export { IMyPluginOptions } from './configuration';
```

The consumer registers everything:

```ts
Aurelia.register(MyPlugin).app(MyApp).start();
```

…or imports one component and registers it individually (tree-shaking the rest):

```ts
import { MpButton } from 'my-plugin';
Aurelia.register(MpButton).app(MyApp).start();
```

## Monorepo workspaces

A plugin that is one package in a monorepo (turborepo, nx, pnpm workspaces) uses the same `package.json` shape — the `exports` map and `peerDependencies` are what matter, not the monorepo tool. The workspace's root `package.json` lists the plugin under `workspaces`; each package builds independently into its own `dist/`. See [plugin-anatomy.md](plugin-anatomy.md) for the entry-point contract and [configuration.md](configuration.md) for the options pattern that the monorepo's shared config package can consume.

## Dual ESM + CJS build configuration

The `tsconfig.build.json` (ESM) sets `"module": "esnext"`, `"outDir": "dist/esm"`. A separate `tsconfig.build.cjs.json` sets `"module": "commonjs"`, `"outDir": "dist/cjs"`, `"extends": "./tsconfig.build.json"`. The build script runs both:

```bash
tsc -p tsconfig.build.json && tsc -p tsconfig.build.cjs.json
```

`verbatimModuleSyntax: true` in the base config ensures `import type` is emitted correctly in both module systems.

## Where to go next

- **Minimal plugin + naming** → [plugin-anatomy.md](plugin-anatomy.md).
- **`.customize()`, AppTask, DI tokens** → [configuration.md](configuration.md).
- **Global resources, value converters, rendering pipeline** → [resources.md](resources.md).
- **Extracting an existing library/slice/shared-dir into a plugin** → [extract.md](extract.md).
- **Component anatomy (variants, `<au-slot>`, token-driven CSS)** → `aurelia-component-library` (assemble).

## Review checklist

- `aurelia` is in `peerDependencies`, never `dependencies`.
- Every `@customElement` uses `{ name, template }` with an explicit `?raw` import — no convention-based pairing.
- `types/assets.d.ts` declares `*.html`, `*.css`, and `*.module.css` modules.
- `exports` maps `.import` → ESM, `.require` → CJS, `.types` → `.d.ts`.
- `files` is `["dist"]` — source and configs do not ship.
- The index exports the aggregate `Plugin`/`Configuration` AND every individual class + `export type` for unions.
- `sideEffects: false` unless the plugin has import-time global side effects.
