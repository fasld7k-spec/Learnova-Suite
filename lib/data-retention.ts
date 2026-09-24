type CleanupDelegate = {
  count(args: { where: { createdAt: { lt: Date } } }): Promise<number>;
  findMany(args: {
    where: { createdAt: { lt: Date } };
    select: { id: true };
    take: number;
    orderBy: { createdAt: 'asc' };
  }): Promise<{ id: string }[]>;
  deleteMany(args: { where: { id: { in: string[] } } }): Promise<{ count: number }>;
};

type PrismaLike = object;

export type RetentionPolicyInput = {
  id: string;
  entity: string;
  days: number;
  active: boolean;
};

export type RetentionCleanupOptions = {
  dryRun?: boolean;
  limit?: number;
  now?: Date;
};

export type RetentionCleanupResult = {
  policyId: string;
  entity: string;
  model: string | null;
  cutoff: string;
  eligible: number;
  deleted: number;
  dryRun: boolean;
  skipped?: string;
};

const RETENTION_MODEL_BY_ENTITY: Record<string, string> = {
  audit_logs: 'auditLog',
  auditlog: 'auditLog',
  audit_log: 'auditLog',
  support_tickets: 'supportTicket',
  supportticket: 'supportTicket',
  support_ticket: 'supportTicket',
  login_history: 'loginHistory',
  loginhistory: 'loginHistory',
  consent_records: 'consentRecord',
  consentrecord: 'consentRecord',
  consent_record: 'consentRecord',
  survey_responses: 'surveyResponse',
  surveyresponse: 'surveyResponse',
  survey_response: 'surveyResponse',
  nps_responses: 'npsResponse',
  npsresponse: 'npsResponse',
  nps_response: 'npsResponse',
  automation_runs: 'automationRun',
  automationrun: 'automationRun',
  automation_run: 'automationRun',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

export function retentionCleanupModel(entity: string): string | null {
  const normalized = entity.toLowerCase().replace(/^demo[._-]/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return RETENTION_MODEL_BY_ENTITY[normalized] ?? null;
}

export function normalizeRetentionCleanupLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

export async function runDataRetentionCleanup(
  prisma: PrismaLike,
  policies: RetentionPolicyInput[],
  options: RetentionCleanupOptions = {},
): Promise<RetentionCleanupResult[]> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? true;
  const limit = normalizeRetentionCleanupLimit(options.limit);
  const results: RetentionCleanupResult[] = [];

  for (const policy of policies) {
    const model = retentionCleanupModel(policy.entity);
    const cutoff = new Date(now.getTime() - policy.days * DAY_MS);
    const base = {
      policyId: policy.id,
      entity: policy.entity,
      model,
      cutoff: cutoff.toISOString(),
      eligible: 0,
      deleted: 0,
      dryRun,
    };

    if (!policy.active) {
      results.push({ ...base, skipped: 'inactive_policy' });
      continue;
    }

    if (!model) {
      results.push({ ...base, skipped: 'unsupported_entity' });
      continue;
    }

    const delegate = (prisma as Record<string, CleanupDelegate | undefined>)[model];
    if (!delegate) {
      results.push({ ...base, skipped: 'missing_delegate' });
      continue;
    }

    const where = { createdAt: { lt: cutoff } };
    const eligible = await delegate.count({ where });
    if (dryRun || eligible === 0) {
      results.push({ ...base, eligible });
      continue;
    }

    const rows = await delegate.findMany({ where, select: { id: true }, take: limit, orderBy: { createdAt: 'asc' } });
    const deleted = rows.length ? (await delegate.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } })).count : 0;
    results.push({ ...base, eligible, deleted });
  }

  return results;
}
