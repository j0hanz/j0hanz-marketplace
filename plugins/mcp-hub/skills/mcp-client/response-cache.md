# Response caching

Use this reference when cacheable MCP list or resource calls need local response reuse.

Server freshness hints (SEP-2549) cover `listTools`, `listPrompts`, `listResources`, `listResourceTemplates`, and `readResource`:

```ts
await client.listTools(); // network, cached
await client.listTools(); // served from cache
await client.listTools(undefined, { cacheMode: 'refresh' }); // refetch and re-store
await client.readResource({ uri }, { cacheMode: 'bypass' });
```

`ttlMs` caps at 24 hours (`MAX_CACHE_TTL_MS`). `responseCacheStore` selects storage (default `InMemoryResponseCacheStore`, 512 entries); `defaultCacheTtlMs` covers servers without hints; change notifications evict matching entries. A multi-user store needs `cachePartition` so `'private'` entries remain isolated.

- [ ] Every shared cache store sets `cachePartition`, and freshness defaults fit the data.
