/**
 * Advanced cache layer with Redis support and an in-process fallback.
 *
 * Features:
 * - Backward-compatible getCached(key, fetcher, ttlSeconds)
 * - Optional tags and stale-while-revalidate windows
 * - Memory cache observability: hits, misses, stale hits, writes
 * - Redis metadata for admin inspection when REDIS_URL is configured
 * - Pattern, tag, key, and full flush invalidation
 *
 * Cache transport failures never break the app. When Redis is unavailable,
 * callers still receive fresh data from the fetcher and admin tools continue
 * to operate against the in-process cache.
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || '';
const META_PREFIX = 'cache:meta:';
const TAG_PREFIX = 'cache:tag:';

type CacheEntry = {
  value: string;
  expiresAt: number;
  staleAt: number;
  ttlSeconds: number;
  staleSeconds: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  hits: number;
  staleHits: number;
  lastAccessedAt: number | null;
};

export type CacheOptions = {
  ttlSeconds?: number;
  staleSeconds?: number;
  tags?: string[];
};

export type CacheRegistryItem = {
  key: string;
  label: string;
  description: string;
  ttl: number;
  tags: string[];
  wildcard?: boolean;
};

export const CACHE_REGISTRY: CacheRegistryItem[] = [
  {
    key: 'site:settings',
    label: 'Site settings',
    description: 'Site-wide settings, branding, active language, home theme, SMTP, storage, AI, and social links.',
    ttl: 60,
    tags: ['settings', 'site', 'theme'],
  },
  {
    key: 'home:page',
    label: 'Home page data',
    description: 'Public home page data: featured courses, active slider, categories, instructors, reviews, and theme settings.',
    ttl: 120,
    tags: ['home', 'courses', 'settings', 'theme'],
  },
  {
    key: 'courses:catalog:all',
    label: 'Course catalog',
    description: 'Full public course catalog listing and shared catalog data.',
    ttl: 300,
    tags: ['courses', 'catalog'],
  },
  {
    key: 'courses:catalog:count',
    label: 'Course catalog count',
    description: 'Published course count used by pagination and catalog totals.',
    ttl: 300,
    tags: ['courses', 'catalog'],
  },
  {
    key: 'courses:catalog:page:*',
    label: 'Course catalog pages',
    description: 'Paginated and filtered course catalog pages.',
    ttl: 300,
    tags: ['courses', 'catalog'],
    wildcard: true,
  },
  {
    key: 'courses:catalog:filters:*',
    label: 'Course filters',
    description: 'Course search, filters, sorting, category, language, and price result groups.',
    ttl: 300,
    tags: ['courses', 'search', 'catalog'],
    wildcard: true,
  },
  {
    key: 'user:*:profile',
    label: 'User profiles',
    description: 'Individual user profile records keyed by user id.',
    ttl: 120,
    tags: ['users', 'profiles'],
    wildcard: true,
  },
];

let redis: Redis | null = null;
let redisAvailable = true;
const memoryCache = new Map<string, CacheEntry>();
const refreshLocks = new Map<string, Promise<unknown>>();
const metrics = {
  hits: 0,
  misses: 0,
  staleHits: 0,
  writes: 0,
  deletes: 0,
  errors: 0,
  redisErrors: 0,
};

function now() {
  return Date.now();
}

function normalizeTags(tags: string[] = []) {
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
}

function normalizeOptions(options?: number | CacheOptions): Required<CacheOptions> {
  if (typeof options === 'number') {
    return { ttlSeconds: Math.max(1, options), staleSeconds: 0, tags: [] };
  }

  return {
    ttlSeconds: Math.max(1, Number(options?.ttlSeconds || 300)),
    staleSeconds: Math.max(0, Number(options?.staleSeconds || 0)),
    tags: normalizeTags(options?.tags || []),
  };
}

function cacheMetaKey(key: string) {
  return `${META_PREFIX}${key}`;
}

function cacheTagKey(tag: string) {
  return `${TAG_PREFIX}${tag}`;
}

function getRedisClient(): Redis | null {
  if (!REDIS_URL) return null;

  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    redis.on('error', (err: Error) => {
      if (redisAvailable) {
        console.warn('[cache] Redis connection error - falling back to direct fetcher:', err.message);
      }
      redisAvailable = false;
      metrics.redisErrors += 1;
    });

    redis.on('connect', () => {
      if (!redisAvailable) console.info('[cache] Redis connection restored.');
      redisAvailable = true;
    });

    redis.on('ready', () => {
      redisAvailable = true;
    });
  }

  return redis;
}

if (REDIS_URL) getRedisClient();

function memorySet(key: string, value: unknown, options: Required<CacheOptions>) {
  const created = now();
  memoryCache.set(key, {
    value: JSON.stringify(value),
    expiresAt: created + (options.ttlSeconds + options.staleSeconds) * 1000,
    staleAt: created + options.ttlSeconds * 1000,
    ttlSeconds: options.ttlSeconds,
    staleSeconds: options.staleSeconds,
    tags: options.tags,
    createdAt: created,
    updatedAt: created,
    hits: 0,
    staleHits: 0,
    lastAccessedAt: null,
  });
  metrics.writes += 1;
}

function memoryGet<T>(key: string) {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  const current = now();
  if (entry.expiresAt <= current) {
    memoryCache.delete(key);
    metrics.deletes += 1;
    return null;
  }

  entry.hits += 1;
  entry.lastAccessedAt = current;
  metrics.hits += 1;
  return {
    value: JSON.parse(entry.value) as T,
    stale: entry.staleAt <= current,
  };
}

async function redisSet(key: string, value: unknown, options: Required<CacheOptions>) {
  const client = getRedisClient();
  if (!client) return;

  const created = now();
  const meta = {
    key,
    ttlSeconds: options.ttlSeconds,
    staleSeconds: options.staleSeconds,
    tags: options.tags,
    createdAt: new Date(created).toISOString(),
    updatedAt: new Date(created).toISOString(),
  };
  const expiration = options.ttlSeconds + options.staleSeconds;

  await client.setex(key, expiration, JSON.stringify(value));
  await client.setex(cacheMetaKey(key), expiration, JSON.stringify(meta));
  if (options.tags.length) {
    await Promise.all(options.tags.map((tag) => client.sadd(cacheTagKey(tag), key)));
  }
}

async function redisDeleteKnownCacheKeys(): Promise<number> {
  const client = getRedisClient();
  if (!client) return 0;

  let deleted = 0;
  try {
    let cursor = '0';
    const keys = new Set<string>();

    do {
      const [nextCursor, metaKeys] = await client.scan(cursor, 'MATCH', `${META_PREFIX}*`, 'COUNT', 100);
      cursor = nextCursor;
      for (const metaKey of metaKeys) {
        keys.add(metaKey);
        keys.add(metaKey.slice(META_PREFIX.length));
      }
    } while (cursor !== '0');

    cursor = '0';
    do {
      const [nextCursor, tagKeys] = await client.scan(cursor, 'MATCH', `${TAG_PREFIX}*`, 'COUNT', 100);
      cursor = nextCursor;
      for (const tagKey of tagKeys) keys.add(tagKey);
    } while (cursor !== '0');

    if (keys.size) deleted += await client.del(...Array.from(keys));
  } catch (err) {
    metrics.redisErrors += 1;
    console.warn('[cache] redisDeleteKnownCacheKeys failed.', (err as Error).message);
  }

  return deleted;
}

async function redisGet<T>(key: string) {
  const client = getRedisClient();
  if (!client) return null;

  const raw = await client.get(key);
  if (raw === null) return null;
  metrics.hits += 1;
  return JSON.parse(raw) as T;
}

async function backgroundRefresh<T>(key: string, fetcher: () => Promise<T>, options: Required<CacheOptions>) {
  if (refreshLocks.has(key)) return;

  const task = (async () => {
    try {
      const value = await fetcher();
      memorySet(key, value, options);
      await redisSet(key, value, options).catch((err) => {
        metrics.redisErrors += 1;
        console.warn(`[cache] backgroundRefresh: Redis SET failed for key "${key}".`, (err as Error).message);
      });
    } catch (err) {
      metrics.errors += 1;
      console.warn(`[cache] backgroundRefresh failed for key "${key}".`, (err as Error).message);
    } finally {
      refreshLocks.delete(key);
    }
  })();

  refreshLocks.set(key, task);
}

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: number | CacheOptions = 300,
): Promise<T> {
  const normalized = normalizeOptions(options);
  const memoryCached = memoryGet<T>(key);
  if (memoryCached) {
    if (memoryCached.stale) {
      metrics.staleHits += 1;
      backgroundRefresh(key, fetcher, normalized);
    }
    return memoryCached.value;
  }

  const client = getRedisClient();
  if (client) {
    try {
      const redisCached = await redisGet<T>(key);
      if (redisCached !== null) {
        memorySet(key, redisCached, normalized);
        return redisCached;
      }
    } catch (err) {
      metrics.redisErrors += 1;
      console.warn(`[cache] getCached: Redis GET failed for key "${key}" - falling back to fetcher.`, (err as Error).message);
    }
  }

  metrics.misses += 1;
  const value = await fetcher();
  memorySet(key, value, normalized);

  if (client) {
    try {
      await redisSet(key, value, normalized);
    } catch (err) {
      metrics.redisErrors += 1;
      console.warn(`[cache] getCached: Redis SET failed for key "${key}".`, (err as Error).message);
    }
  }

  return value;
}

export async function invalidateCache(key: string): Promise<void> {
  await clearCache([key]);
}

export async function invalidateSiteSettingsCache() {
  return clearCache(['tag:settings', 'site:settings', 'tag:home']);
}

export async function invalidateCourseCatalogCache() {
  return clearCache(['tag:courses', 'courses:catalog:*', 'courses:catalog:count', 'tag:home']);
}

export async function invalidateHomeCache() {
  return clearCache(['tag:home', 'home:page']);
}

export async function invalidateUserProfileCache(userId: string) {
  const id = String(userId || '').trim();
  if (!id) return { flushed: [], deleted: 0 };
  return clearCache([`user:${id}:profile`]);
}

function wildcardToRegExp(pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export async function invalidateCachePattern(pattern: string): Promise<number> {
  const matcher = wildcardToRegExp(pattern);
  let deleted = 0;

  for (const key of Array.from(memoryCache.keys())) {
    if (matcher.test(key)) {
      memoryCache.delete(key);
      deleted += 1;
    }
  }

  const client = getRedisClient();
  if (!client) {
    metrics.deletes += deleted;
    return deleted;
  }

  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      const metaKeys = keys.map(cacheMetaKey);
      if (keys.length) deleted += await client.del(...keys, ...metaKeys);
    } while (cursor !== '0');
  } catch (err) {
    metrics.redisErrors += 1;
    console.warn(`[cache] invalidateCachePattern: Redis scan/delete failed for pattern "${pattern}".`, (err as Error).message);
  }

  metrics.deletes += deleted;
  return deleted;
}

export async function invalidateCacheTag(tag: string): Promise<number> {
  const normalizedTag = tag.trim().toLowerCase();
  if (!normalizedTag) return 0;
  let deleted = 0;

  for (const [key, entry] of Array.from(memoryCache.entries())) {
    if (entry.tags.includes(normalizedTag)) {
      memoryCache.delete(key);
      deleted += 1;
    }
  }

  const client = getRedisClient();
  if (client) {
    try {
      const tagKey = cacheTagKey(normalizedTag);
      const keys = await client.smembers(tagKey);
      if (keys.length) deleted += await client.del(...keys, ...keys.map(cacheMetaKey));
      await client.del(tagKey);
    } catch (err) {
      metrics.redisErrors += 1;
      console.warn(`[cache] invalidateCacheTag: Redis tag delete failed for tag "${normalizedTag}".`, (err as Error).message);
    }
  }

  metrics.deletes += deleted;
  return deleted;
}

export async function clearCache(keys: string[] = []): Promise<{ flushed: string[]; deleted: number }> {
  const uniqueKeys = Array.from(new Set(keys.map((key) => key.trim()).filter(Boolean)));

  if (!uniqueKeys.length || uniqueKeys.includes('*')) {
    const memoryDeleted = memoryCache.size;
    memoryCache.clear();
    const redisDeleted = await redisDeleteKnownCacheKeys();
    metrics.deletes += memoryDeleted + redisDeleted;
    return { flushed: ['*'], deleted: memoryDeleted + redisDeleted };
  }

  let deleted = 0;
  for (const key of uniqueKeys) {
    if (key.startsWith('tag:')) {
      deleted += await invalidateCacheTag(key.slice(4));
    } else if (key.includes('*')) {
      deleted += await invalidateCachePattern(key);
    } else {
      const existed = memoryCache.delete(key);
      if (existed) deleted += 1;

      const client = getRedisClient();
      if (client) {
        try {
          deleted += await client.del(key, cacheMetaKey(key));
        } catch (err) {
          metrics.redisErrors += 1;
          console.warn(`[cache] clearCache: Redis DEL failed for key "${key}".`, (err as Error).message);
        }
      }
    }
  }

  metrics.deletes += deleted;
  return { flushed: uniqueKeys, deleted };
}

function entryStatus(entry: CacheEntry | undefined) {
  if (!entry) return 'miss';
  const current = now();
  if (entry.expiresAt <= current) return 'expired';
  if (entry.staleAt <= current) return 'stale';
  return 'fresh';
}

async function redisKeyStatus(key: string, wildcard?: boolean) {
  const client = getRedisClient();
  if (!client) return null;

  try {
    if (wildcard) {
      let count = 0;
      let cursor = '0';
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', key, 'COUNT', 100);
        cursor = nextCursor;
        count += keys.length;
      } while (cursor !== '0');
      return { exists: count > 0, ttl: null as number | null, matched: count };
    }

    const [exists, ttl, rawMeta] = await Promise.all([
      client.exists(key),
      client.ttl(key),
      client.get(cacheMetaKey(key)),
    ]);
    return {
      exists: exists > 0,
      ttl: ttl >= 0 ? ttl : null,
      matched: exists,
      meta: rawMeta ? JSON.parse(rawMeta) : null,
    };
  } catch (err) {
    metrics.redisErrors += 1;
    console.warn(`[cache] redisKeyStatus failed for key "${key}".`, (err as Error).message);
    return null;
  }
}

export async function getCacheOverview(registry: CacheRegistryItem[] = CACHE_REGISTRY) {
  const client = getRedisClient();
  const provider = client ? 'redis' : 'memory';
  const memoryEntries = Array.from(memoryCache.entries()).map(([key, entry]) => ({
    key,
    ttlSeconds: entry.ttlSeconds,
    staleSeconds: entry.staleSeconds,
    status: entryStatus(entry),
    tags: entry.tags,
    hits: entry.hits,
    staleHits: entry.staleHits,
    ageSeconds: Math.max(0, Math.round((now() - entry.createdAt) / 1000)),
    expiresInSeconds: Math.max(0, Math.round((entry.expiresAt - now()) / 1000)),
    lastAccessedAt: entry.lastAccessedAt ? new Date(entry.lastAccessedAt).toISOString() : null,
  }));

  const keys = await Promise.all(registry.map(async (item) => {
    const memoryMatches = item.wildcard
      ? memoryEntries.filter((entry) => wildcardToRegExp(item.key).test(entry.key))
      : memoryEntries.filter((entry) => entry.key === item.key);
    const redisStatus = await redisKeyStatus(item.key, item.wildcard);
    const memoryStatus = memoryMatches.length
      ? memoryMatches.some((entry) => entry.status === 'fresh') ? 'fresh' : memoryMatches[0].status
      : 'miss';

    return {
      ...item,
      status: redisStatus?.exists ? 'redis' : memoryStatus,
      memoryEntries: memoryMatches.length,
      redisEntries: redisStatus?.matched || 0,
      ttlRemaining: redisStatus?.ttl ?? null,
      meta: redisStatus && 'meta' in redisStatus ? redisStatus.meta : null,
    };
  }));

  return {
    provider,
    redisConfigured: Boolean(REDIS_URL),
    redisAvailable: client ? redisAvailable : false,
    memorySize: memoryCache.size,
    refreshInFlight: refreshLocks.size,
    metrics: { ...metrics },
    keys,
    memoryEntries,
  };
}
