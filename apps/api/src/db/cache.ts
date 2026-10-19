import Redis from "ioredis";
import { env } from "../config/env";

type CacheEntry = { value: string; expiresAt: number };

class MemoryCache {
  private store = new Map<string, CacheEntry>();

  get(key: string): string | null {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }

  set(key: string, value: string, ttlSeconds: number) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(key: string) {
    this.store.delete(key);
  }
}

export interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

class RedisCache implements Cache {
  constructor(private client: Redis) {}
  async get(key: string) {
    return this.client.get(key);
  }
  async set(key: string, value: string, ttlSeconds: number) {
    await this.client.set(key, value, "EX", ttlSeconds);
  }
  async del(key: string) {
    await this.client.del(key);
  }
}

const memory = new MemoryCache();

const memoryAdapter: Cache = {
  async get(key) {
    return memory.get(key);
  },
  async set(key, value, ttl) {
    memory.set(key, value, ttl);
  },
  async del(key) {
    memory.del(key);
  },
};

let adapter: Cache = memoryAdapter;

if (env.REDIS_URL) {
  const client = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
  client.on("error", (err) => console.warn("[cache] Redis error, using in-memory fallback:", err.message));
  adapter = new RedisCache(client);
}

export const cache = adapter;

export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const hit = await cache.get(key).catch(() => null);
  if (hit) return JSON.parse(hit) as T;
  const value = await loader();
  await cache.set(key, JSON.stringify(value), ttlSeconds).catch(() => undefined);
  return value;
}
