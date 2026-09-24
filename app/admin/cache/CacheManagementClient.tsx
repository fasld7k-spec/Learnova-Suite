'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, DatabaseZap, Flame, Gauge, RefreshCw, RotateCcw, Search, Server, Tags, Trash2, Zap } from 'lucide-react';

type CacheKeyRow = {
  key: string;
  label: string;
  description: string;
  ttl: number;
  tags: string[];
  wildcard?: boolean;
  status: string;
  memoryEntries: number;
  redisEntries: number;
  ttlRemaining: number | null;
};

type MemoryEntry = {
  key: string;
  ttlSeconds: number;
  staleSeconds: number;
  status: string;
  tags: string[];
  hits: number;
  staleHits: number;
  ageSeconds: number;
  expiresInSeconds: number;
  lastAccessedAt: string | null;
};

type CacheOverview = {
  provider: string;
  redisConfigured: boolean;
  redisAvailable: boolean;
  memorySize: number;
  refreshInFlight: number;
  metrics: {
    hits: number;
    misses: number;
    staleHits: number;
    writes: number;
    deletes: number;
    errors: number;
    redisErrors: number;
  };
  keys: CacheKeyRow[];
  memoryEntries: MemoryEntry[];
};

type ApiResponse<T> = { success?: boolean; data?: T; message?: string; error?: string };

function tone(status: string) {
  if (['fresh', 'redis'].includes(status)) return 'border-[#00BA7C]/60 bg-[#00BA7C]/10 text-[#5EE4B3]';
  if (status === 'stale') return 'border-[#FFD400]/60 bg-[#FFD400]/10 text-[#FFE36E]';
  if (status === 'expired') return 'border-[#F4212E]/60 bg-[#F4212E]/10 text-[#FF7A83]';
  return 'border-[#2A3037] bg-[#101317] text-[#D7DEE4]';
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="moe-panel rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-black text-white">{value}</p>
          <p className="mt-2 text-sm font-semibold text-[#8A949E]">{label}</p>
        </div>
        <span className="moe-mini-icon shrink-0">{icon}</span>
      </div>
    </div>
  );
}

export function CacheManagementClient({ csrfToken, initialOverview }: { csrfToken: string; initialOverview: CacheOverview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customTag, setCustomTag] = useState('');
  const [filter, setFilter] = useState('');

  const allTags = useMemo(() => {
    return Array.from(new Set(overview.keys.flatMap((key) => key.tags))).sort();
  }, [overview.keys]);

  const filteredKeys = overview.keys.filter((row) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return `${row.key} ${row.label} ${row.description} ${row.tags.join(' ')}`.toLowerCase().includes(q);
  });

  async function refresh() {
    const res = await fetch('/api/admin/cache', { cache: 'no-store' });
    const data = (await res.json()) as ApiResponse<CacheOverview>;
    if (res.ok && data.success && data.data) setOverview(data.data);
  }

  async function run(label: string, request: () => Promise<Response>) {
    setBusy(label);
    setMessage('');
    try {
      const res = await request();
      const data = (await res.json()) as ApiResponse<any>;
      if (!res.ok || !data.success) {
        setMessage(data.message || data.error || 'Cache action failed.');
        return;
      }
      const deleted = data.data?.deleted;
      const warmed = data.data?.warmed;
      setMessage(warmed ? `Warmed ${warmed}.` : deleted === undefined ? 'Cache action completed.' : `Cache action completed. Deleted ${deleted} entr${deleted === 1 ? 'y' : 'ies'}.`);
      await refresh();
    } catch {
      setMessage('Network error while running cache action.');
    } finally {
      setBusy(null);
    }
  }

  function flushKey(key: string) {
    return run(`flush:${key}`, () => fetch('/api/admin/cache', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ key }),
    }));
  }

  function warmKey(key: string) {
    return run(`warm:${key}`, () => fetch('/api/admin/cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ action: 'warm', key }),
    }));
  }

  function warmAll() {
    return run('warm:all', () => fetch('/api/admin/cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ action: 'warm_all' }),
    }));
  }

  function flushAll() {
    return run('flush:all', () => fetch('/api/admin/cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ action: 'flush_all' }),
    }));
  }

  function flushTag(tag: string) {
    return run(`tag:${tag}`, () => fetch('/api/admin/cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ action: 'flush_tag', tag }),
    }));
  }

  return (
    <div className="grid gap-6">
      {message && (
        <div className="border border-[#1D9BF0]/50 bg-[#1D9BF0]/10 p-4 text-sm font-bold text-[#D8EFFF]">
          {message}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Provider" value={overview.provider === 'redis' ? 'Redis' : 'Memory'} icon={<Server size={18} />} />
        <Stat label="Memory entries" value={overview.memorySize} icon={<DatabaseZap size={18} />} />
        <Stat label="Hit ratio" value={`${overview.metrics.hits + overview.metrics.misses ? Math.round((overview.metrics.hits / (overview.metrics.hits + overview.metrics.misses)) * 100) : 0}%`} icon={<Gauge size={18} />} />
        <Stat label="Refresh in flight" value={overview.refreshInFlight} icon={<RefreshCw size={18} />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="border border-[#2F3336] bg-black p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#71767B]">Runtime cache</p>
              <h2 className="mt-1 text-2xl font-black text-white">Advanced cache registry</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71767B]">
                Inspect cache health, warm important entries, flush a single key, clear wildcard groups, or invalidate by tag after content changes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={refresh} disabled={busy !== null}>
                <RefreshCw size={16} /> Refresh
              </button>
              <button className="btn-secondary" onClick={warmAll} disabled={busy !== null}>
                <Flame size={16} /> Warm registry
              </button>
              <button className="btn-secondary border-red-400/40 text-red-200" onClick={flushAll} disabled={busy !== null}>
                <Trash2 size={16} /> Flush registry
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 border border-[#2F3336] bg-[#050608] px-3 py-2">
            <Search size={16} className="text-[#71767B]" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#71767B]"
              placeholder="Search cache keys, tags, descriptions..."
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="border-b border-[#2F3336] text-left text-xs uppercase text-[#71767B]">
                <tr>
                  <th className="px-3 py-3">Key</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">TTL</th>
                  <th className="px-3 py-3">Tags</th>
                  <th className="px-3 py-3">Entries</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2F3336]">
                {filteredKeys.map((row) => (
                  <tr key={row.key} className="align-top">
                    <td className="px-3 py-4">
                      <p className="font-black text-white">{row.label}</p>
                      <code className="mt-1 block break-all text-xs text-[#1D9BF0]">{row.key}</code>
                      <p className="mt-2 max-w-md text-xs leading-5 text-[#71767B]">{row.description}</p>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${tone(row.status)}`}>{row.status}</span>
                    </td>
                    <td className="px-3 py-4 text-[#D7DEE4]">
                      <p>{row.ttl}s default</p>
                      <p className="mt-1 text-xs text-[#71767B]">{row.ttlRemaining === null ? 'No Redis TTL' : `${row.ttlRemaining}s Redis TTL`}</p>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap gap-1">
                        {row.tags.map((tag) => (
                          <button
                            className="rounded-md border border-[#2F3336] px-2 py-1 text-xs font-bold text-[#D7DEE4] hover:border-[#1D9BF0]"
                            key={`${row.key}-${tag}`}
                            onClick={() => flushTag(tag)}
                            disabled={busy !== null}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-[#D7DEE4]">
                      <p>{row.memoryEntries} memory</p>
                      <p className="mt-1 text-xs text-[#71767B]">{row.redisEntries} Redis</p>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-secondary h-9 px-3 text-xs" onClick={() => flushKey(row.key)} disabled={busy !== null}>
                          <Trash2 size={14} /> Flush
                        </button>
                        {!row.wildcard && (
                          <button className="btn-secondary h-9 px-3 text-xs" onClick={() => warmKey(row.key)} disabled={busy !== null}>
                            <Flame size={14} /> Warm
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <div className="border border-[#2F3336] bg-black p-5">
            <h3 className="text-lg font-black text-white">Cache health</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-3 border-b border-[#2F3336] pb-3">
                <span className="text-[#71767B]">Redis configured</span>
                <span className="font-black text-white">{overview.redisConfigured ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-[#2F3336] pb-3">
                <span className="text-[#71767B]">Redis available</span>
                <span className="font-black text-white">{overview.redisAvailable ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-[#2F3336] pb-3">
                <span className="text-[#71767B]">Hits</span>
                <span className="font-black text-white">{overview.metrics.hits}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-[#2F3336] pb-3">
                <span className="text-[#71767B]">Misses</span>
                <span className="font-black text-white">{overview.metrics.misses}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-[#2F3336] pb-3">
                <span className="text-[#71767B]">Stale hits</span>
                <span className="font-black text-white">{overview.metrics.staleHits}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-[#2F3336] pb-3">
                <span className="text-[#71767B]">Writes</span>
                <span className="font-black text-white">{overview.metrics.writes}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#71767B]">Redis errors</span>
                <span className="font-black text-white">{overview.metrics.redisErrors}</span>
              </div>
            </div>
          </div>

          <div className="border border-[#2F3336] bg-black p-5">
            <h3 className="flex items-center gap-2 text-lg font-black text-white"><Tags size={18} /> Flush by tag</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button className="btn-secondary h-9 px-3 text-xs" key={tag} onClick={() => flushTag(tag)} disabled={busy !== null}>
                  {tag}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-2">
              <input className="input" value={customTag} onChange={(event) => setCustomTag(event.target.value)} placeholder="Custom tag, e.g. courses" />
              <button className="btn-secondary w-fit" onClick={() => customTag.trim() && flushTag(customTag.trim())} disabled={busy !== null || !customTag.trim()}>
                <Zap size={16} /> Flush tag
              </button>
            </div>
          </div>

          <div className="border border-[#2F3336] bg-black p-5">
            <h3 className="text-lg font-black text-white">Flush custom key or pattern</h3>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Use exact keys like site:settings or wildcard patterns like courses:catalog:page:*.
            </p>
            <div className="mt-4 grid gap-2">
              <input className="input" value={customKey} onChange={(event) => setCustomKey(event.target.value)} placeholder="cache key or pattern" />
              <button className="btn-secondary w-fit" onClick={() => customKey.trim() && flushKey(customKey.trim())} disabled={busy !== null || !customKey.trim()}>
                <RotateCcw size={16} /> Flush custom
              </button>
            </div>
          </div>
        </aside>
      </section>

      <section className="border border-[#2F3336] bg-black p-5">
        <div className="mb-4 flex items-center gap-2">
          <Activity size={18} className="text-[#1D9BF0]" />
          <h2 className="text-lg font-black text-white">Memory entries</h2>
        </div>
        {overview.memoryEntries.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.memoryEntries.map((entry) => (
              <div className="border border-[#2F3336] p-4" key={entry.key}>
                <code className="break-all text-xs text-[#1D9BF0]">{entry.key}</code>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${tone(entry.status)}`}>{entry.status}</span>
                  <span className="rounded-md border border-[#2F3336] px-2 py-1 text-xs font-bold text-[#D7DEE4]">{entry.expiresInSeconds}s left</span>
                  <span className="rounded-md border border-[#2F3336] px-2 py-1 text-xs font-bold text-[#D7DEE4]">{entry.hits} hits</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#71767B]">No in-process memory entries yet. Visit public pages or warm cache keys to populate it.</p>
        )}
      </section>
    </div>
  );
}
