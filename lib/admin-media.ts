import { readdir, rm, stat } from 'fs/promises';
import path from 'path';

export type MediaAsset = {
  name: string;
  url: string;
  relativePath: string;
  extension: string;
  size: number;
  updatedAt: Date;
  type: 'image' | 'video' | 'pdf' | 'file';
};

const publicUploadRoot = path.resolve(process.cwd(), 'public', 'uploads');

function mediaType(extension: string): MediaAsset['type'] {
  const ext = extension.toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) return 'image';
  if (['.mp4', '.webm', '.mov'].includes(ext)) return 'video';
  if (ext === '.pdf') return 'pdf';
  return 'file';
}

async function walkUploads(dir: string, prefix = ''): Promise<MediaAsset[]> {
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  try {
    entries = await readdir(dir, { withFileTypes: true }) as unknown as Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  } catch {
    return [];
  }

  const assets = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) return walkUploads(fullPath, relativePath);
    if (!entry.isFile()) return [];

    const info = await stat(fullPath);
    const extension = path.extname(entry.name);
    return [{
      name: entry.name,
      url: `/uploads/${relativePath}`,
      relativePath,
      extension,
      size: info.size,
      updatedAt: info.mtime,
      type: mediaType(extension),
    }];
  }));

  return assets.flat();
}

export async function listLocalMediaAssets(limit = 120) {
  const assets = await walkUploads(publicUploadRoot);
  return assets
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}

export function formatMediaSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export async function deleteLocalMediaAsset(url: string) {
  const parsed = String(url || '').trim();
  if (!parsed.startsWith('/uploads/')) throw new Error('Only local uploaded media can be deleted here.');

  const relative = parsed.replace(/^\/uploads\/?/, '').replace(/\\/g, '/');
  if (!relative || relative.includes('..')) throw new Error('Invalid media path.');

  const target = path.resolve(publicUploadRoot, relative);
  if (target !== publicUploadRoot && !target.startsWith(`${publicUploadRoot}${path.sep}`)) {
    throw new Error('Invalid media path.');
  }

  await rm(target, { force: true });
}
