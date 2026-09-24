/**
 * Audit logging utility.
 * Writes structured audit events to the AuditLog table.
 *
 * Requirements: 11.5
 */

import { prisma } from '@/lib/prisma';

export interface AuditLogEntry {
  /** The action being performed, e.g. "auth.login.success" */
  action: string;
  /** The user performing the action (null for unauthenticated attempts) */
  userId?: string | null;
  /** The IP address of the request */
  ip?: string | null;
  /** The entity type being acted upon, e.g. "User", "TwoFactorAuth" */
  entity?: string;
  /** The entity ID being acted upon */
  entityId?: string | null;
  /** Additional structured details about the event */
  details?: Record<string, unknown>;
}

/**
 * Persist an audit log entry. Failures are silently swallowed so that
 * audit logging never breaks the primary request flow.
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity ?? 'System',
        entityId: entry.entityId ?? null,
        metadata: entry.details ? JSON.stringify(entry.details) : null,
        ip: entry.ip ?? null,
      },
    });
  } catch {
    // Audit log failures must never break the primary request flow
  }
}
