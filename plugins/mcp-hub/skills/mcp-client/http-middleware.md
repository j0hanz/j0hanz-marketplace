# HTTP fetch middleware

Use this reference when a Streamable HTTP client needs headers, logging, or retries.

```ts
import { applyMiddlewares, createMiddleware, withLogging } from '@modelcontextprotocol/client';

const tagRequests = createMiddleware(async (next, input, init) => {
  const headers = new Headers(init?.headers);
  headers.set('X-Request-Source', 'reports-cli');
  return next(input, { ...init, headers });
});

const transport = new StreamableHTTPClientTransport(url, {
  fetch: applyMiddlewares(tagRequests, withLogging({ statusLevel: 400 }))(fetch),
});
```

The final `applyMiddlewares` argument is outermost: place retries first, closest to the network. Each middleware returns a `Response`; use `response.clone()` to read a body. Give `withLogging()` a custom `logger` to keep stdio stdout clean.

- [ ] Middleware order puts retries innermost and returns `Response` values; logging uses a non-stdout logger on stdio.
