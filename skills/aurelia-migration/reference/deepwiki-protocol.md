# DeepWiki Ground-Truth Protocol

**Every canonical claim cites DeepWiki.** A claim about how Aurelia 2 works
without a DeepWiki link is a guess. The link format is a literal template —
matches the GitHub-blob view of the aurelia/aurelia `master` branch.

## Link format

```
https://github.com/aurelia/aurelia/blob/master/packages/<package-name>/docs/<file>.md
```

The `<package-name>` is one of the v2 monorepo packages; the `<file>` is a
specific doc inside `packages/<package-name>/docs/`. Do not link to root
`docs/`, do not link to the v1 monorepo, do not paraphrase.

## Per-pillar canonical URLs

| Pillar | Package | Doc |
| :--- | :--- | :--- |
| **Dependency injection** | `kernel` | [di-overview.md](https://github.com/aurelia/aurelia/blob/master/packages/kernel/docs/di-overview.md) |
| **Components** | `runtime-html` | [components.md](https://github.com/aurelia/aurelia/blob/master/packages/runtime-html/docs/components.md) |
| **Templating** | `runtime-html` | [templating.md](https://github.com/aurelia/aurelia/blob/master/packages/runtime-html/docs/templating.md) |
| **Bindings** | `runtime` | [bindings.md](https://github.com/aurelia/aurelia/blob/master/packages/runtime/docs/bindings.md) |
| **Lifecycle hooks** | `runtime` | [lifecycle.md](https://github.com/aurelia/aurelia/blob/master/packages/runtime/docs/lifecycle.md) |
| **Custom elements** | `runtime-html` | [custom-elements.md](https://github.com/aurelia/aurelia/blob/master/packages/runtime-html/docs/custom-elements.md) |
| **Router-lite** | `router-lite` | [navigating.md](https://github.com/aurelia/aurelia/blob/master/packages/router-lite/docs/navigating.md) |
| **Router-lite (route config)** | `router-lite` | [routing.md](https://github.com/aurelia/aurelia/blob/master/packages/router-lite/docs/routing.md) |
| **Composability (`au-compose`)** | `runtime-html` | [au-compose.md](https://github.com/aurelia/aurelia/blob/master/packages/runtime-html/docs/au-compose.md) |
| **State plugin** | `state` | [overview.md](https://github.com/aurelia/aurelia/blob/master/packages/state/docs/overview.md) |
| **Validation** | `validation` | [overview.md](https://github.com/aurelia/aurelia/blob/master/packages/validation/docs/overview.md) |
| **Fetch / HTTP** | `fetch-client` | [fetch-client.md](https://github.com/aurelia/aurelia/blob/master/packages/fetch-client/docs/fetch-client.md) |
| **i18n** | `i18n` | [i18n.md](https://github.com/aurelia/aurelia/blob/master/packages/i18n/docs/i18n.md) |

These are the most-cited pages; if a claim doesn't map to one, search
[DeepWiki](https://deepwiki.com/aurelia/aurelia) for the matching `package/docs/`
file before inventing a path.

## The rule

When stating how Aurelia 2 works, the format is:

> "`X` does `Y`. ([aurelia/aurelia/blob/master/packages/PKG/docs/FILE.md](URL))"

If a doc URL is needed but the table above doesn't list the page, use the same
template and **verify** the file path exists on the `master` branch before
publishing. A bad link is worse than no link.

## Examples

### Correct — links to ground truth

> Use `resolve()` instead of `@inject`. It returns the registered binding by
> interface key, supports lazy and optional resolvers, and improves TS
> inference. ([kernel/docs/di-overview.md](https://github.com/aurelia/aurelia/blob/master/packages/kernel/docs/di-overview.md))

> The router-lite `IContextRouter` resolves relative paths against the
> component's owning route — preferable to `IRouter` for context-aware
> navigation. ([router-lite/docs/navigating.md](https://github.com/aurelia/aurelia/blob/master/packages/router-lite/docs/navigating.md))

> Co-locate the template by convention — `name.ts` + `name.html` —
> and skip manual template overrides. ([runtime-html/docs/components.md](https://github.com/aurelia/aurelia/blob/master/packages/runtime-html/docs/components.md))

### Wrong — vague or no link

> "Aurelia 2 uses the standard dependency injection system from the kernel."

(No link. Which doc? Which page? The model will hallucinate specifics.)

> "According to https://docs.aurelia.io/..."

(Wrong domain — `docs.aurelia.io` is the marketing site, not the source.
Use the GitHub blob path.)

> "Per https://github.com/aurelia/aurelia/blob/master/README.md..."

(Wrong file — root README does not contain API contracts.)

## What this skill defers

- **DeepWiki MCP-based retrieval** (the `read_wiki_contents` /
  `ask_question` tool) — `aurelia-authoring` decides when to call them.
- **Authoring conventions** (Feature-First, Model/DTO, registration maps) —
  `aurelia-authoring`.
- **Web-component standard references** (when a v2 behaviour is a standards
  choice, not Aurelia-specific) — defer to the WHATWG/W3C spec.
