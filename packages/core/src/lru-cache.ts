/**
 * Simple LRU cache with TTL support, suitable for caching file reads.
 * NOT thread-safe but Effect serializes access per-key via its runtime.
 */
export class LruCache<K, V> {
  private capacity: number
  private ttlMs: number
  private map: Map<K, { value: V; expires: number }>

  constructor(capacity: number, ttlMs: number) {
    this.capacity = capacity
    this.ttlMs = ttlMs
    this.map = new Map()
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expires) {
      this.map.delete(key)
      return undefined
    }
    // Move to end (most recently used)
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key)
    else if (this.map.size >= this.capacity) {
      // Evict least recently used (first entry)
      const lru = this.map.keys().next()
      if (!lru.done) this.map.delete(lru.value)
    }
    this.map.set(key, { value, expires: Date.now() + this.ttlMs })
  }

  invalidate(key: K): void {
    this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }

  get size(): number {
    return this.map.size
  }
}
