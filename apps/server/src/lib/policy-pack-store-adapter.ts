/**
 * Policy Pack Store Adapter
 *
 * Adapts DrizzlePolicyPackStorage to IPolicyPackStore interface.
 *
 * @module lib/policy-pack-store-adapter
 */

import type {
  CreatePolicyPackInput,
  IPolicyPackStore,
  PolicyPackState,
  StateTransitionInput,
  StoredPolicyPack,
} from '@popper/core';
import type { ApiPolicyPack, DrizzlePolicyPackStorage } from '@popper/db';

/**
 * Converts database API response to StoredPolicyPack
 */
function toStoredPolicyPack(api: ApiPolicyPack): StoredPolicyPack {
  return {
    id: api.id,
    organization_id: api.organization_id,
    policy_id: api.policy_id,
    version: api.version,
    state: api.state as PolicyPackState,
    content: api.content as StoredPolicyPack['content'],
    created_by: api.created_by,
    reviewed_by: api.reviewed_by,
    validation_result: api.validation_result as StoredPolicyPack['validation_result'],
    submitted_at: api.submitted_at,
    approved_at: api.approved_at,
    activated_at: api.activated_at,
    archived_at: api.archived_at,
    rejection_reason: api.rejection_reason,
    change_notes: api.change_notes,
    created_at: api.created_at,
    updated_at: api.updated_at,
  };
}

/**
 * PolicyPackStoreAdapter - Adapts DrizzlePolicyPackStorage to IPolicyPackStore
 */
export class PolicyPackStoreAdapter implements IPolicyPackStore {
  constructor(private readonly storage: DrizzlePolicyPackStorage) {}

  async create(input: CreatePolicyPackInput): Promise<StoredPolicyPack> {
    const api = await this.storage.create({
      organization_id: input.organization_id,
      policy_id: input.policy_id,
      version: input.version,
      content: input.content,
      created_by: input.created_by,
      change_notes: input.change_notes,
    });
    return toStoredPolicyPack(api);
  }

  async getById(id: string): Promise<StoredPolicyPack | null> {
    const api = await this.storage.getById(id);
    return api ? toStoredPolicyPack(api) : null;
  }

  async getByVersion(
    organizationId: string | null,
    policyId: string,
    version: string,
  ): Promise<StoredPolicyPack | null> {
    const api = await this.storage.getByVersion(organizationId, policyId, version);
    return api ? toStoredPolicyPack(api) : null;
  }

  async getActive(
    organizationId: string | null,
    policyId: string,
  ): Promise<StoredPolicyPack | null> {
    const api = await this.storage.getActive(organizationId, policyId);
    return api ? toStoredPolicyPack(api) : null;
  }

  async getHistory(
    organizationId: string | null,
    policyId: string,
    limit?: number,
  ): Promise<StoredPolicyPack[]> {
    const apis = await this.storage.getHistory(organizationId, policyId, limit);
    return apis.map(toStoredPolicyPack);
  }

  async list(options: {
    organizationId?: string | null;
    policyId?: string;
    state?: PolicyPackState;
    limit?: number;
  }): Promise<StoredPolicyPack[]> {
    const apis = await this.storage.list(options);
    return apis.map(toStoredPolicyPack);
  }

  async updateState(id: string, input: StateTransitionInput): Promise<StoredPolicyPack | null> {
    const api = await this.storage.updateState(id, {
      state: input.state,
      reviewed_by: input.reviewed_by,
      validation_result: input.validation_result,
      rejection_reason: input.rejection_reason,
    });
    return api ? toStoredPolicyPack(api) : null;
  }

  async archiveOthers(
    organizationId: string | null,
    policyId: string,
    exceptId: string,
  ): Promise<number> {
    return this.storage.archiveOthers(organizationId, policyId, exceptId);
  }

  async updateContent(
    id: string,
    content: StoredPolicyPack['content'],
    changeNotes?: string,
  ): Promise<StoredPolicyPack | null> {
    const api = await this.storage.updateContent(id, content, changeNotes);
    return api ? toStoredPolicyPack(api) : null;
  }
}
