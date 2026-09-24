import { createWriteStream } from 'fs';
import { copyFile, mkdir, readdir, rm, stat } from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';

export type BackupFile = {
  name: string;
  relativePath: string;
  size: number;
  updatedAt: Date;
};

const backupRoot = path.join(/* turbopackIgnore: true */ process.cwd(), 'storage', 'backups');

function isPostgresUrl(url: string) {
  return /^postgres(ql)?:\/\//i.test(url);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function hasPgDump() {
  return new Promise<boolean>((resolve) => {
    const child = spawn('pg_dump', ['--version'], { stdio: 'ignore', windowsHide: true });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function runPgDump(databaseUrl: string, destinationPath: string) {
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(destinationPath, { flags: 'wx' });
    const child = spawn('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', databaseUrl], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const errors: Buffer[] = [];

    child.stdout.pipe(out);
    child.stderr.on('data', (chunk) => errors.push(Buffer.from(chunk)));
    child.on('error', reject);
    out.on('error', reject);
    child.on('close', (code) => {
      out.end();
      if (code === 0) resolve();
      else reject(new Error(Buffer.concat(errors).toString('utf8').trim() || `pg_dump exited with code ${code}`));
    });
  });
}

export async function runDatabaseBackup() {
  const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';

  if (isPostgresUrl(databaseUrl)) {
    if (!(await hasPgDump())) {
      return {
        type: 'postgres',
        status: 'REQUIRES_CONFIGURATION',
        message: 'PostgreSQL backup requires pg_dump on PATH or a configured managed database backup policy.',
      };
    }

    await mkdir(backupRoot, { recursive: true });
    const backupFile = `postgres-${timestamp()}.dump`;
    const destinationPath = path.join(backupRoot, backupFile);
    try {
      await runPgDump(databaseUrl, destinationPath);
    } catch (error) {
      await rm(destinationPath, { force: true }).catch(() => null);
      throw error;
    }

    return {
      type: 'postgres',
      status: 'SUCCESS',
      message: `PostgreSQL backup created at storage/backups/${backupFile}`,
    };
  }

  const sqlitePath = databaseUrl.startsWith('file:') ? databaseUrl.replace(/^file:/, '') : './prisma/dev.db';
  const cleanSqlitePath = sqlitePath.replace(/^\.\/?/, '');
  const sourcePath = cleanSqlitePath.startsWith('prisma/')
    ? path.resolve(/* turbopackIgnore: true */ process.cwd(), cleanSqlitePath)
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), 'prisma', cleanSqlitePath);

  await stat(sourcePath);

  await mkdir(backupRoot, { recursive: true });

  const backupFile = `sqlite-${timestamp()}.db`;
  const destinationPath = path.join(backupRoot, backupFile);
  await copyFile(sourcePath, destinationPath);

  return {
    type: 'sqlite',
    status: 'SUCCESS',
    message: `SQLite backup created at storage/backups/${backupFile}`,
  };
}

export function resolveBackupFile(name: string) {
  const cleanName = String(name || '').trim().replace(/\\/g, '/');
  if (!cleanName || cleanName.includes('/') || cleanName.includes('..')) {
    throw new Error('Invalid backup file name.');
  }

  const target = path.resolve(backupRoot, cleanName);
  if (target !== backupRoot && !target.startsWith(`${backupRoot}${path.sep}`)) {
    throw new Error('Invalid backup file path.');
  }
  return target;
}

export async function listLocalBackupFiles(limit = 100): Promise<BackupFile[]> {
  let entries: Array<{ name: string; isFile(): boolean }>;
  try {
    entries = await readdir(backupRoot, { withFileTypes: true }) as unknown as Array<{ name: string; isFile(): boolean }>;
  } catch {
    return [];
  }

  const files = await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile()) return null;
    const fullPath = resolveBackupFile(entry.name);
    const info = await stat(fullPath);
    return {
      name: entry.name,
      relativePath: `storage/backups/${entry.name}`,
      size: info.size,
      updatedAt: info.mtime,
    };
  }));

  return files
    .filter((file): file is BackupFile => Boolean(file))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}

export async function deleteLocalBackupFile(name: string) {
  const target = resolveBackupFile(name);
  await rm(target, { force: true });
}
