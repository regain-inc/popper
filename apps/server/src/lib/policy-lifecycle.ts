/**
 * Global policy lifecycle manager instance
 *
 * Provides singleton access to the PolicyLifecycleManager for the application.
 *
 * @module lib/policy-lifecycle
 */

import {
  InMemoryPolicyPackCache,
  type IPolicyPackStore,
  PolicyLifecycleManager,
  policyRegistry,
  type StoredPolicyPack,
} from '@popper/core';

// =============================================================================
// In-Memory Store (for development/testing when no DB available)
// =============================================================================

class InMemoryPolicyPackStore implements IPolicyPackStore {
  private packs = new Map<string, StoredPolicyPack>();
  private idCounter = 0;

  async create(input: {
    organization_id: string | null;
    policy_id: string;
    version: string;
    content: unknown;
    created_by: string;
    change_notes?: string;
  }): Promise<StoredPolicyPack> {
    const now = new Date();
    const id = `pp_${++this.idCounter}`;
    const pack: StoredPolicyPack = {
      id,
      organization_id: input.organization_id,
      policy_id: input.policy_id,
      version: input.version,
      state: 'DRAFT',
      content: input.content as StoredPolicyPack['content'],
      created_by: input.created_by,
      reviewed_by: null,
      validation_result: null,
      submitted_at: null,
      approved_at: null,
      activated_at: null,
      archived_at: null,
      rejection_reason: null,
      change_notes: input.change_notes ?? null,
      created_at: now,
      updated_at: now,
    };
    this.packs.set(id, pack);
    return pack;
  }

  async getById(id: string): Promise<StoredPolicyPack | null> {
    return this.packs.get(id) ?? null;
  }

  async getByVersion(
    organizationId: string | null,
    policyId: string,
    version: string,
  ): Promise<StoredPolicyPack | null> {
    for (const pack of this.packs.values()) {
      if (
        pack.organization_id === organizationId &&
        pack.policy_id === policyId &&
        pack.version === version
      ) {
        return pack;
      }
    }
    return null;
  }

  async getActive(
    organizationId: string | null,
    policyId: string,
  ): Promise<StoredPolicyPack | null> {
    for (const pack of this.packs.values()) {
      if (
        pack.organization_id === organizationId &&
        pack.policy_id === policyId &&
        pack.state === 'ACTIVE'
      ) {
        return pack;
      }
    }
    return null;
  }

  async getHistory(
    organizationId: string | null,
    policyId: string,
    limit = 100,
  ): Promise<StoredPolicyPack[]> {
    const result: StoredPolicyPack[] = [];
    for (const pack of this.packs.values()) {
      if (pack.organization_id === organizationId && pack.policy_id === policyId) {
        result.push(pack);
      }
    }
    return result.sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, limit);
  }

  async list(options: {
    organizationId?: string | null;
    policyId?: string;
    state?: StoredPolicyPack['state'];
    limit?: number;
  }): Promise<StoredPolicyPack[]> {
    let result = Array.from(this.packs.values());

    if (options.organizationId !== undefined) {
      result = result.filter((p) => p.organization_id === options.organizationId);
    }
    if (options.policyId) {
      result = result.filter((p) => p.policy_id === options.policyId);
    }
    if (options.state) {
      result = result.filter((p) => p.state === options.state);
    }

    return result
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, options.limit ?? 100);
  }

  async updateState(
    id: string,
    input: {
      state: StoredPolicyPack['state'];
      reviewed_by?: string;
      validation_result?: StoredPolicyPack['validation_result'];
      rejection_reason?: string;
    },
  ): Promise<StoredPolicyPack | null> {
    const pack = this.packs.get(id);
    if (!pack) return null;

    const now = new Date();
    pack.state = input.state;
    pack.updated_at = now;

    if (input.state === 'REVIEW') {
      pack.submitted_at = now;
    } else if (input.state === 'STAGED') {
      pack.reviewed_by = input.reviewed_by ?? null;
      pack.validation_result = input.validation_result ?? null;
      pack.approved_at = now;
    } else if (input.state === 'ACTIVE') {
      pack.activated_at = now;
    } else if (input.state === 'ARCHIVED') {
      pack.archived_at = now;
    } else if (input.state === 'REJECTED') {
      pack.reviewed_by = input.reviewed_by ?? null;
      pack.rejection_reason = input.rejection_reason ?? null;
    }

    return pack;
  }

  async archiveOthers(
    organizationId: string | null,
    policyId: string,
    exceptId: string,
  ): Promise<number> {
    let count = 0;
    const now = new Date();
    for (const pack of this.packs.values()) {
      if (
        pack.organization_id === organizationId &&
        pack.policy_id === policyId &&
        pack.state === 'ACTIVE' &&
        pack.id !== exceptId
      ) {
        pack.state = 'ARCHIVED';
        pack.archived_at = now;
        pack.updated_at = now;
        count++;
      }
    }
    return count;
  }

  async updateContent(
    id: string,
    content: StoredPolicyPack['content'],
    changeNotes?: string,
  ): Promise<StoredPolicyPack | null> {
    const pack = this.packs.get(id);
    if (!pack || pack.state !== 'DRAFT') return null;

    pack.content = content;
    if (changeNotes !== undefined) {
      pack.change_notes = changeNotes;
    }
    pack.updated_at = new Date();
    return pack;
  }
}

// =============================================================================
// Singleton
// =============================================================================

// Default to in-memory store and cache (replaced at startup if DB available)
let globalManager: PolicyLifecycleManager = new PolicyLifecycleManager({
  store: new InMemoryPolicyPackStore(),
  cache: new InMemoryPolicyPackCache(),
  onPolicyActivated: (pack) => {
    // Register activated policy in runtime registry for supervision
    policyRegistry.register(pack.content, true);
  },
});

/**
 * Set the global PolicyLifecycleManager instance
 *
 * Called at startup to configure the manager with proper store.
 */
export function setPolicyLifecycleManager(manager: PolicyLifecycleManager): void {
  globalManager = manager;
}

/**
 * Get the global PolicyLifecycleManager instance
 */
export function getPolicyLifecycleManager(): PolicyLifecycleManager {
  return globalManager;
}

// Re-export the in-memory store for testing
export { InMemoryPolicyPackStore };
