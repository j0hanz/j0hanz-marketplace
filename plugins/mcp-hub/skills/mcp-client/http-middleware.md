# HTTP fetch middleware

Ref for Streamable HTTP client need headers, logging, retries.

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

Final `applyMiddlewares` argument outermost: retries first, closest to network. Each middleware return `Response`; use `response.clone()` read body. Give `withLogging()` custom `logger` keep stdio stdout clean.

- [ ] Middleware order put retries innermost, return `Response` values; logging use non-stdout logger on stdio.
