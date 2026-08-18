# Response caching

Reference for cacheable MCP list/resource calls needing local reuse.

Server freshness hints (SEP-2549) cover `listTools`, `listPrompts`, `listResources`, `listResourceTemplates`, `readResource`:

```ts
await client.listTools(); // network, cached
await client.listTools(); // served from cache
await client.listTools(undefined, { cacheMode: 'refresh' }); // refetch and re-store
await client.readResource({ uri }, { cacheMode: 'bypass' });
```

`ttlMs` cap: 24h (`MAX_CACHE_TTL_MS`). `responseCacheStore` picks storage (default `InMemoryResponseCacheStore`, 512 entries); `defaultCacheTtlMs` covers servers w/o hints; change notifications evict matching entries. Multi-user store needs `cachePartition` so `'private'` entries stay isolated.

- [ ] Every shared cache store sets `cachePartition`, freshness defaults fit data.
