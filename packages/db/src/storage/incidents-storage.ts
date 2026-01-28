/**
 * Incidents storage layer
 *
 * Provides PostgreSQL storage for drift-triggered incidents.
 *
 * @module storage/incidents
 */

import { and, desc, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type Incident, incidents, type NewIncident } from '../schema/incidents';

/**
 * Interface for incidents storage
 */
export interface IIncidentsStore {
  /** Create a new incident */
  create(incident: NewIncident): Promise<Incident>;
  /** Get incident by ID */
  getById(id: string): Promise<Incident | null>;
  /** Get open incidents for organization */
  getOpen(organizationId: string): Promise<Incident[]>;
  /** Get incident history for organization */
  getHistory(organizationId: string, limit?: number): Promise<Incident[]>;
  /** Update incident status */
  updateStatus(
    id: string,
    status: 'acknowledged' | 'resolved',
    resolvedBy?: string,
    resolutionNotes?: string,
  ): Promise<Incident | null>;
  /** Check if there's an active incident for a signal */
  hasActiveIncident(organizationId: string, triggerSignal: string): Promise<boolean>;
}

/**
 * Drizzle-based incidents storage
 */
export class DrizzleIncidentsStorage implements IIncidentsStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async create(incident: NewIncident): Promise<Incident> {
    const [result] = await this.db.insert(incidents).values(incident).returning();
    return result;
  }

  async getById(id: string): Promise<Incident | null> {
    const results = await this.db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    return results[0] ?? null;
  }

  async getOpen(organizationId: string): Promise<Incident[]> {
    return this.db
      .select()
      .from(incidents)
      .where(and(eq(incidents.organizationId, organizationId), eq(incidents.status, 'open')))
      .orderBy(desc(incidents.createdAt));
  }

  async getHistory(organizationId: string, limit = 100): Promise<Incident[]> {
    return this.db
      .select()
      .from(incidents)
      .where(eq(incidents.organizationId, organizationId))
      .orderBy(desc(incidents.createdAt))
      .limit(limit);
  }

  async updateStatus(
    id: string,
    status: 'acknowledged' | 'resolved',
    resolvedBy?: string,
    resolutionNotes?: string,
  ): Promise<Incident | null> {
    const updateData: Partial<Incident> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
      if (resolvedBy) updateData.resolvedBy = resolvedBy;
      if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
    }

    const [result] = await this.db
      .update(incidents)
      .set(updateData)
      .where(eq(incidents.id, id))
      .returning();

    return result ?? null;
  }

  async hasActiveIncident(organizationId: string, triggerSignal: string): Promise<boolean> {
    const results = await this.db
      .select({ id: incidents.id })
      .from(incidents)
      .where(
        and(
          eq(incidents.organizationId, organizationId),
          eq(incidents.triggerSignal, triggerSignal),
          eq(incidents.status, 'open'),
        ),
      )
      .limit(1);

    return results.length > 0;
  }
}

/**
 * In-memory incidents storage for testing
 */
export class InMemoryIncidentsStorage implements IIncidentsStore {
  private incidents: Incident[] = [];
  private nextId = 1;

  async create(incident: NewIncident): Promise<Incident> {
    const now = new Date();
    const newIncident: Incident = {
      id: incident.id ?? `incident-${this.nextId++}`,
      organizationId: incident.organizationId,
      type: incident.type,
      status: incident.status ?? 'open',
      triggerSignal: incident.triggerSignal ?? null,
      triggerLevel: incident.triggerLevel ?? null,
      triggerValue: incident.triggerValue ?? null,
      thresholdValue: incident.thresholdValue ?? null,
      baselineValue: incident.baselineValue ?? null,
      title: incident.title,
      description: incident.description ?? null,
      metadata: incident.metadata ?? null,
      safeModeEnabled: incident.safeModeEnabled ?? null,
      resolvedAt: incident.resolvedAt ?? null,
      resolvedBy: incident.resolvedBy ?? null,
      resolutionNotes: incident.resolutionNotes ?? null,
      cooldownUntil: incident.cooldownUntil ?? null,
      createdAt: incident.createdAt ?? now,
      updatedAt: incident.updatedAt ?? now,
    };
    this.incidents.push(newIncident);
    return newIncident;
  }

  async getById(id: string): Promise<Incident | null> {
    return this.incidents.find((i) => i.id === id) ?? null;
  }

  async getOpen(organizationId: string): Promise<Incident[]> {
    return this.incidents
      .filter((i) => i.organizationId === organizationId && i.status === 'open')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getHistory(organizationId: string, limit = 100): Promise<Incident[]> {
    return this.incidents
      .filter((i) => i.organizationId === organizationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async updateStatus(
    id: string,
    status: 'acknowledged' | 'resolved',
    resolvedBy?: string,
    resolutionNotes?: string,
  ): Promise<Incident | null> {
    const incident = this.incidents.find((i) => i.id === id);
    if (!incident) return null;

    incident.status = status;
    incident.updatedAt = new Date();

    if (status === 'resolved') {
      incident.resolvedAt = new Date();
      if (resolvedBy) incident.resolvedBy = resolvedBy;
      if (resolutionNotes) incident.resolutionNotes = resolutionNotes;
    }

    return incident;
  }

  async hasActiveIncident(organizationId: string, triggerSignal: string): Promise<boolean> {
    return this.incidents.some(
      (i) =>
        i.organizationId === organizationId &&
        i.triggerSignal === triggerSignal &&
        i.status === 'open',
    );
  }

  /** Clear all incidents (for testing) */
  clear(): void {
    this.incidents = [];
    this.nextId = 1;
  }
}
