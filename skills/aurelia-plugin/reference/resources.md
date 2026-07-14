# Resources — global registration and rendering-pipeline extensions

A plugin registers resources into the consumer's root container so they are available app-wide without `<require>` or `dependencies` arrays. The same `container.register(...)` call handles custom elements, custom attributes, value converters, and binding behaviours. When a plugin needs deeper integration — intercepting how Aurelia renders instructions, reading the view factory, or embedding into a foreign framework's host node — the rendering-pipeline extension points (`IRenderer`, `IRendering`, `registerHostNode`) provide the escape hatches.

## Global resource registration

Every `@customElement`, `@customAttribute`, `valueConverter`, and `bindingBehavior` is a resource. Registering one globally makes it ambient:

```ts
import { valueConverter, bindingBehavior, type IContainer } from 'aurelia';
import { MpButton } from './mp-button';
import { MpCard } from './mp-card';

@valueConverter('mp-truncate')
export class MpTruncateValueConverter {
  public toView(value: string, max: number = 50): string {
    return value.length > max ? value.slice(0, max) + '…' : value;
  }
}

@bindingBehavior('mp-throttle')
export class MpThrottleBindingBehavior {
  public bind(binding: unknown): void {
    // throttle the binding's update callback
  }
}

export const MyPlugin = {
  register(container: IContainer): void {
    container.register(
      MpButton,
      MpCard,
      MpTruncateValueConverter,
      MpThrottleBindingBehavior,
    );
  },
};
```

The consumer can now use `<mp-button>`, `<mp-card>`, `${text | mp-truncate:100}`, and `change.mp-throttle="..."` anywhere — no imports, no `dependencies` arrays.

## Resource prefixes

Globally-registered resources live in one shared namespace. Two plugins that both register an element named `<button>` collide silently — the last registration wins, and the consumer has no way to disambiguate. Prefix every resource with the plugin name:

| Resource kind | Bad (collides) | Good (prefixed) |
| :--- | :--- | :--- |
| Custom element | `button` | `mp-button` |
| Custom element | `card` | `mp-card` |
| Value converter | `truncate` | `mp-truncate` |
| Binding behaviour | `throttle` | `mp-throttle` |
| Custom attribute | `tooltip` | `mp-tooltip` |

The prefix is the plugin's npm package short-name — `mp` for `my-plugin`, `ui` for `@my-org/ui-kit`. This is the same discipline `aurelia-component-library` applies to the `ui-` prefix; the difference is that a library is in-app while a plugin is cross-app, so the prefix is mandatory, not advisory.

## Value converters and binding behaviours as resources

Value converters and binding behaviours are resources, not classes that consumers instantiate. They are declared with the `valueConverter` and `bindingBehavior` decorators (or the lower-level `register` call), and Aurelia's resource system manages their lifecycle.

A plugin that ships a set of converters (e.g. an i18n plugin shipping `date-format`, `number-format`, `currency-format`) registers them all in its `register`:

```ts
export const MyI18nPlugin = {
  register(container: IContainer): void {
    container.register(
      DateFormatValueConverter,
      NumberFormatValueConverter,
      CurrencyFormatValueConverter,
    );
  },
};
```

## Rendering-pipeline escape hatch 1 — `IRenderer` + `@renderer`

`IRenderer` lets a plugin intercept a specific rendering instruction type and decide how it becomes DOM. The `@renderer(instruction)` decorator binds a class to an instruction class. The most common use is a custom instruction that the plugin's own bindings emit.

A translate plugin, for example, can define a `TranslateInstruction` and a `TranslateRenderer` that reads the instruction's key, resolves it against the loaded translations, and writes the string into the target node:

```ts
import { IRenderer, IRenderLocation, renderer } from '@aurelia/runtime-html';
import type { IContainer, IObserverLocator } from '@aurelia/runtime-html';

export class TranslateInstruction {
  public constructor(
    public readonly key: string,
    public readonly params: Record<string, string> | null,
  ) {}
}

@renderer(TranslateInstruction)
export class TranslateRenderer implements IRenderer<TranslateInstruction> {
  public constructor(
    private readonly container: IContainer,
  ) {}

  public render(
    instruction: TranslateInstruction,
    location: IRenderLocation,
    observerLocator: IObserverLocator,
  ): void {
    const translator: ITranslator = this.container.get(ITranslator);
    const node: Text = location as unknown as Text;
    node.textContent = translator.translate(instruction.key, instruction.params ?? {});
  }
}
```

Register the renderer in the plugin's `register`:

```ts
container.register(TranslateRenderer);
```

Now any rendering instruction of type `TranslateInstruction` that enters the pipeline is handled by `TranslateRenderer.render(...)` instead of the default renderer.

## Rendering-pipeline escape hatch 2 — `IRendering` (`getViewFactory`, `createNodes`)

`IRendering` is the service that compiles template definitions into view factories and node sequences. A plugin resolves it to build dynamic views on the fly (a form-builder, a table generator, a markdown renderer) or to produce detached node sequences for headless rendering, SSR, or projection into a foreign framework's host.

```ts
import { resolve } from 'aurelia';
import type {
  CustomElementDefinition,
  FragmentNodeSequence,
  IContainer,
  IRendering,
  IViewFactory,
} from '@aurelia/runtime-html';

export class DynamicFormService {
  private readonly rendering: IRendering = resolve(IRendering);
  private readonly container: IContainer = resolve(IContainer);

  public buildFactory(template: string): IViewFactory {
    return this.rendering.getViewFactory(
      { template, dependencies: [MpInput, MpSelect] },
      this.container,
    );
  }

  public buildNodes(definition: CustomElementDefinition): FragmentNodeSequence {
    return this.rendering.createNodes(definition);
  }
}
```

`getViewFactory(definition, container)` compiles a `PartialCustomElementDefinition` **and** binds it to a container — the container scopes the resource lookups and DI for the generated view. The returned `IViewFactory` creates view instances that Aurelia manages like any compiled view: they participate in the lifecycle, DI, and binding system.

`createNodes(definition)` returns a `FragmentNodeSequence` (an `INodeSequence`) detached from any controller. Use it when you need a compiled fragment without a host — to hand to `registerHostNode`, an SSR pipeline, or a foreign-framework adopter. The caller owns attaching and tearing it down.

## Rendering-pipeline escape hatch 3 — `registerHostNode`

`registerHostNode(container, hostNode)` tells Aurelia to render into a DOM node that the consumer owns — typically a node created by a foreign framework (React, Angular, Vue, a CMS, a legacy jQuery app). This is the integration point for embedding Aurelia components into non-Aurelia hosts.

```ts
import { registerHostNode, Aurelia } from 'aurelia';
import type { IContainer } from 'aurelia';

export function mountWidget(
  host: HTMLElement,
  props: Record<string, string>,
): () => void {
  const au: Aurelia = new Aurelia();
  const container: IContainer = au.container;
  registerHostNode(container, host);
  au.register(
    MyPlugin,
    Registration.instance(IWidgetProps, props),
  ).app({ host, component: MpWidget }).start();

  return (): void => {
    au.stop();
    host.textContent = '';
  };
}
```

The returned teardown function stops Aurelia and clears the host. The consumer (the foreign framework) calls it on unmount.

## Where to go next

- **`package.json`, dual builds, `?raw` imports for templates/styles** → [distribution.md](distribution.md).
- **Minimal plugin + naming conventions** → [plugin-anatomy.md](plugin-anatomy.md).
- **`.customize()`, AppTask, DI tokens** → [configuration.md](configuration.md).
- **Custom-element anatomy (`@bindable`, `<au-slot>`, `.style`)** → `aurelia-component-library` (assemble) and `aurelia-foundation` (scaffold).
- **DI resolution mechanics (`resolve`, child containers)** → `aurelia-runtime` (resolve).

## Review checklist

- Every globally-registered resource has the plugin-name prefix (`mp-`, not bare `button`).
- Value converters use `@valueConverter`; binding behaviours use `@bindingBehavior` — both are registered in the same `container.register(...)` call.
- Custom renderers use `@renderer(InstructionClass)` and implement `IRenderer<InstructionType>`.
- `IRendering.getViewFactory` is used only for genuinely dynamic templates; static templates use the `template:` field with `?raw` imports.
- `registerHostNode` is paired with a teardown function that calls `au.stop()` and clears the host.
- No resource registration relies on `globalResources` — that v1 API does not exist in v2.
