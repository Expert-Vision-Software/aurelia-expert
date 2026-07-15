<!-- Adapted from aurelia/skills (MIT) `references/fetch-client.md`; canonical source aurelia/aurelia. -->

# `@aurelia/fetch-client` — HTTP Client

`@aurelia/fetch-client` is the standard Aurelia 2 HTTP client — a thin, DI-friendly wrapper around
the native `fetch` API with configuration, interceptors, retry, and caching. It ships **inside the
`aurelia` meta-package**, so no extra install is needed when you depend on `aurelia`. Import from
`@aurelia/fetch-client`.

## Getting a client (DI)

Resolve `IHttpClient` as a class field. Each `resolve(IHttpClient)` returns the same shared client by
default; use `newInstanceOf(IHttpClient)` for an isolated, separately-configured client.

```typescript
import { resolve } from 'aurelia';
import { IHttpClient, json } from '@aurelia/fetch-client';

export class UserApi {
  private http = resolve(IHttpClient);

  async getUser(id: string): Promise<User> {
    const res = await this.http.get(`/users/${id}`);
    return res.json();
  }

  async createUser(data: Partial<User>): Promise<User> {
    const res = await this.http.post('/users', json(data));
    return res.json();
  }
}
```

For an isolated client you fully own and configure (recommended for a dedicated API service):

```typescript
import { resolve, newInstanceOf } from 'aurelia';
import { IHttpClient } from '@aurelia/fetch-client';

export class ApiService {
  private http = resolve(newInstanceOf(IHttpClient));

  constructor() {
    this.http.configure(c => c.withBaseUrl('https://api.example.com/v1/'));
  }
}
```

## Requests

All methods return the native `Promise<Response>`. Read the body with `.json()`, `.text()`, `.blob()`.

- `http.get(url, options?)`
- `http.post(url, body?, options?)`
- `http.put(url, body?, options?)`
- `http.patch(url, body?, options?)`
- `http.delete(url, body?, options?)`
- `http.fetch(urlOrRequest, options?)` — escape hatch for any method

Use the `json()` helper to serialize a body and set `Content-Type: application/json`. Unlike
`JSON.stringify(undefined)`, `json(undefined)` returns `'{}'`.

```typescript
http.post('/users', json({ name: 'Alice' }));
```

## Configuration

Call `http.configure(callback)` once (e.g. in the service constructor or `main.ts`). The callback
receives a chainable configuration builder.

```typescript
import { RetryStrategy } from '@aurelia/fetch-client';

this.http.configure(c => c
  .withBaseUrl('https://api.example.com/v1/')
  .withDefaults({
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  .withInterceptor(authInterceptor)
  .rejectErrorResponses()          // make 4xx/5xx reject instead of resolve
  .withRetry({ maxRetries: 3, strategy: RetryStrategy.exponential, interval: 1000 })
);
```

Builder methods:

- `withBaseUrl(url)` — prepended to relative request URLs.
- `withDefaults(requestInit)` — default `RequestInit` merged into every request. Header values may be
  functions, evaluated per request (e.g. `{ Authorization: () => \`Bearer ${token()}\` }`).
- `withInterceptor(interceptor)` — register an interceptor (call multiple times to chain).
- `rejectErrorResponses()` — reject the promise on non-2xx responses.
- `useStandardConfiguration()` — applies `same-origin` credentials plus `rejectErrorResponses()`.
- `withRetry(config?)` — register the retry interceptor. **Must be the last interceptor**, and only
  one retry interceptor is allowed.
- `withDispatcher(node)` — dispatch DOM lifecycle events (`HttpClientEvent.started` / `.drained`).

The client also exposes `isRequesting`, `activeRequestCount`, and `isConfigured`.

## Interceptors

An interceptor is a plain object; every method is optional.

```typescript
import type { IHttpClient } from '@aurelia/fetch-client';

const authInterceptor = {
  request(request: Request): Request {
    const token = localStorage.getItem('auth_token');
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },

  async responseError(error: unknown, request?: Request, client?: IHttpClient): Promise<Response> {
    if (error instanceof Response && error.status === 401) {
      const token = await refreshToken();
      request!.headers.set('Authorization', `Bearer ${token}`);
      return client!.fetch(request!);   // retry once with a fresh token
    }
    throw error;
  },
};
```

Interceptor hooks: `request`, `requestError`, `response`, `responseError`, `dispose`. A `request`
hook may return a `Response` to short-circuit fetch; a `response` hook may return a `Request` to
trigger another round-trip.

## Cancellation

Pass an `AbortSignal` via options:

```typescript
const controller = new AbortController();
const promise = http.get('/slow', { signal: controller.signal });
controller.abort();                       // rejects with an AbortError
```

Caveat: combining `AbortController` with the retry interceptor can retry an already-aborted request.
Guard it: `withRetry({ doRetry: (res, req) => !req.signal?.aborted && res.status >= 500 })`.

## Retry & caching (advanced)

- **Retry:** `withRetry({ maxRetries, strategy, interval, doRetry?, beforeRetry? })`.
  `RetryStrategy` is `fixed | incremental | exponential | random`. `exponential` requires
  `interval >= 1000`. Must be the last registered interceptor.
- **Caching:** `CacheInterceptor` with a storage backend (`MemoryStorage` default,
  `BrowserLocalStorage`, `BrowserSessionStorage`, `BrowserIndexDBStorage`). Supports `cacheTime`,
  `staleTime`, and background refresh. The cache key is the full URL including query string (headers
  do not affect it). Manual access via `resolve(ICacheService)`.

## Gotchas

- The retry interceptor must be registered **last**; only **one** is allowed.
- A `Request` body can only be read once — `request.clone()` inside an interceptor if you need it.
- `withDefaults` headers merge with per-request headers; per-request wins.
- The default `IHttpClient` is shared. Use `newInstanceOf(IHttpClient)` to avoid one service's
  `configure()` leaking into another.
- This package's singleton-DI-over-EventAggregator guardrail applies: prefer a typed `ApiService`
  singleton for cross-component data flow over an EA bus.
