import { beforeEach, describe, expect, it } from 'bun:test';
import { computeRequestHash, InMemoryIdempotencyCache } from './idempotency-cache';

describe('computeRequestHash', () => {
  it('should produce consistent hash for same object', () => {
    const obj = { a: 1, b: 2 };
    const hash1 = computeRequestHash(obj);
    const hash2 = computeRequestHash(obj);
    expect(hash1).toBe(hash2);
  });

  it('should produce same hash regardless of key order', () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { c: 3, a: 1, b: 2 };
    expect(computeRequestHash(obj1)).toBe(computeRequestHash(obj2));
  });

  it('should exclude request_timestamp from hash', () => {
    const obj1 = { a: 1, request_timestamp: '2024-01-01T00:00:00Z' };
    const obj2 = { a: 1, request_timestamp: '2024-01-02T00:00:00Z' };
    expect(computeRequestHash(obj1)).toBe(computeRequestHash(obj2));
  });

  it('should exclude created_at from hash', () => {
    const obj1 = { a: 1, trace: { created_at: '2024-01-01T00:00:00Z', id: '1' } };
    const obj2 = { a: 1, trace: { created_at: '2024-01-02T00:00:00Z', id: '1' } };
    expect(computeRequestHash(obj1)).toBe(computeRequestHash(obj2));
  });

  it('should produce different hash for different values', () => {
    const obj1 = { a: 1 };
    const obj2 = { a: 2 };
    expect(computeRequestHash(obj1)).not.toBe(computeRequestHash(obj2));
  });

  it('should handle nested objects', () => {
    const obj1 = { a: { b: { c: 1 } } };
    const obj2 = { a: { b: { c: 1 } } };
    expect(computeRequestHash(obj1)).toBe(computeRequestHash(obj2));
  });

  it('should handle arrays', () => {
    const obj1 = { items: [1, 2, 3] };
    const obj2 = { items: [1, 2, 3] };
    expect(computeRequestHash(obj1)).toBe(computeRequestHash(obj2));
  });

  it('should differentiate array order', () => {
    const obj1 = { items: [1, 2, 3] };
    const obj2 = { items: [3, 2, 1] };
    expect(computeRequestHash(obj1)).not.toBe(computeRequestHash(obj2));
  });

  it('should handle null and undefined', () => {
    const obj1 = { a: null, b: undefined };
    const obj2 = { a: null, b: undefined };
    expect(computeRequestHash(obj1)).toBe(computeRequestHash(obj2));
  });
});

describe('InMemoryIdempotencyCache', () => {
  let cache: InMemoryIdempotencyCache<{ decision: string }>;
  const orgId = 'org-123';
  const idempotencyKey = 'idem-456';

  beforeEach(() => {
    cache = new InMemoryIdempotencyCache({ ttlSeconds: 1 });
  });

  describe('check', () => {
    it('should return "new" for uncached request', async () => {
      const hash = cache.computeRequestHash({ a: 1 });
      const result = await cache.check(orgId, idempotencyKey, hash);
      expect(result.status).toBe('new');
    });

    it('should return "cached" for identical request', async () => {
      const request = { a: 1 };
      const hash = cache.computeRequestHash(request);
      const response = { decision: 'APPROVED' };

      await cache.store(orgId, idempotencyKey, hash, response);

      const result = await cache.check(orgId, idempotencyKey, hash);
      expect(result.status).toBe('cached');
      if (result.status === 'cached') {
        expect(result.response).toEqual(response);
      }
    });

    it('should return "replay_suspected" for different payload with same key', async () => {
      const request1 = { a: 1 };
      const request2 = { a: 2 };
      const hash1 = cache.computeRequestHash(request1);
      const hash2 = cache.computeRequestHash(request2);
      const response = { decision: 'APPROVED' };

      await cache.store(orgId, idempotencyKey, hash1, response);

      const result = await cache.check(orgId, idempotencyKey, hash2);
      expect(result.status).toBe('replay_suspected');
      if (result.status === 'replay_suspected') {
        expect(result.cached_hash).toBe(hash1);
        expect(result.new_hash).toBe(hash2);
      }
    });

    it('should isolate by organization ID', async () => {
      const hash = cache.computeRequestHash({ a: 1 });
      const response = { decision: 'APPROVED' };

      await cache.store('org-1', idempotencyKey, hash, response);

      // Different org should get "new"
      const result = await cache.check('org-2', idempotencyKey, hash);
      expect(result.status).toBe('new');
    });

    it('should isolate by idempotency key', async () => {
      const hash = cache.computeRequestHash({ a: 1 });
      const response = { decision: 'APPROVED' };

      await cache.store(orgId, 'key-1', hash, response);

      // Different key should get "new"
      const result = await cache.check(orgId, 'key-2', hash);
      expect(result.status).toBe('new');
    });
  });

  describe('TTL expiration', () => {
    it('should return "new" for expired entries', async () => {
      // Use very short TTL
      const shortCache = new InMemoryIdempotencyCache<{ decision: string }>({
        ttlSeconds: 0.05, // 50ms
      });

      const hash = shortCache.computeRequestHash({ a: 1 });
      const response = { decision: 'APPROVED' };

      await shortCache.store(orgId, idempotencyKey, hash, response);

      // Verify it's cached
      let result = await shortCache.check(orgId, idempotencyKey, hash);
      expect(result.status).toBe('cached');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Should be expired
      result = await shortCache.check(orgId, idempotencyKey, hash);
      expect(result.status).toBe('new');
    });
  });

  describe('delete', () => {
    it('should remove cached entry', async () => {
      const hash = cache.computeRequestHash({ a: 1 });
      const response = { decision: 'APPROVED' };

      await cache.store(orgId, idempotencyKey, hash, response);

      let result = await cache.check(orgId, idempotencyKey, hash);
      expect(result.status).toBe('cached');

      await cache.delete(orgId, idempotencyKey);

      result = await cache.check(orgId, idempotencyKey, hash);
      expect(result.status).toBe('new');
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      const hash = cache.computeRequestHash({ a: 1 });
      const response = { decision: 'APPROVED' };

      await cache.store('org-1', 'key-1', hash, response);
      await cache.store('org-2', 'key-2', hash, response);

      expect(cache.size).toBe(2);

      cache.clear();

      expect(cache.size).toBe(0);
    });
  });
});

describe('Real-world supervision request hashing', () => {
  it('should produce stable hash for supervision request', () => {
    const request = {
      hermes_version: '1.6.0',
      mode: 'advocate_clinical',
      system: 'deutsch',
      idempotency_key: 'req-123',
      request_timestamp: '2024-01-15T10:30:00Z',
      trace: {
        trace_id: 'trace-abc',
        created_at: '2024-01-15T10:30:00Z',
      },
      subject: {
        subject_id: 'patient-xyz',
        organization_id: 'org-456',
      },
      proposals: [
        {
          proposal_id: 'prop-1',
          kind: 'LIFESTYLE_RECOMMENDATION',
          content: 'Increase water intake',
        },
      ],
    };

    // Same request with different timestamps should hash the same
    const request2 = {
      ...request,
      request_timestamp: '2024-01-15T11:00:00Z',
      trace: {
        ...request.trace,
        created_at: '2024-01-15T11:00:00Z',
      },
    };

    expect(computeRequestHash(request)).toBe(computeRequestHash(request2));
  });

  it('should differentiate requests with different proposals', () => {
    const baseRequest = {
      hermes_version: '1.6.0',
      mode: 'advocate_clinical',
      idempotency_key: 'req-123',
      subject: { subject_id: 'patient-xyz' },
    };

    const request1 = {
      ...baseRequest,
      proposals: [{ proposal_id: 'prop-1', kind: 'LIFESTYLE_RECOMMENDATION' }],
    };

    const request2 = {
      ...baseRequest,
      proposals: [{ proposal_id: 'prop-1', kind: 'MEDICATION_ORDER_PROPOSAL' }],
    };

    expect(computeRequestHash(request1)).not.toBe(computeRequestHash(request2));
  });
});
