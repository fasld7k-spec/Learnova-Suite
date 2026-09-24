export function isPostgresDatabase() {
  return /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || '');
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? parseJson(parsed) : parsed;
  } catch {
    return value;
  }
}

function normalizeStringArray(value: unknown): string[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(String).filter(Boolean);
}

export function toJson(value: unknown): any {
  return isPostgresDatabase() ? value : JSON.stringify(value);
}

export function toList(value: unknown): any {
  const list = normalizeStringArray(value);
  return isPostgresDatabase() ? list : JSON.stringify(list);
}

export function listHas(value: string): any {
  return isPostgresDatabase() ? { has: value } : { contains: JSON.stringify(value) };
}

export function fromJsonArray<T = unknown>(value: unknown): T[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed as T[] : [];
}

export function fromJsonObject<T extends Record<string, unknown> = Record<string, unknown>>(value: unknown): T {
  const parsed = parseJson(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : {} as T;
}
