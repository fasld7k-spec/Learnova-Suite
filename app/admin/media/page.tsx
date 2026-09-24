import Image from 'next/image';
import { CheckCircle2, CloudUpload, DatabaseZap, FileImage, HardDriveUpload, Trash2 } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { formatMediaSize, listLocalMediaAssets } from '@/lib/admin-media';
import { getSiteSettings } from '@/lib/site-settings';
import { CsrfInput } from '@/components/CsrfInput';

const adapters = [
  { label: 'Local storage', body: 'Best for development, demos, and single-server installs.', icon: HardDriveUpload },
  { label: 'S3 compatible', body: 'Works with AWS S3, Cloudflare R2, DigitalOcean Spaces, and similar providers.', icon: DatabaseZap },
  { label: 'Course media', body: 'Shared by course covers, lesson resources, certificates, and support attachments.', icon: FileImage }
];

export default async function MediaLibrary(props: { searchParams?: Promise<{ uploaded?: string; deleted?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const [settings, assets] = await Promise.all([getSiteSettings(), listLocalMediaAssets()]);
  const provider = settings.storageProvider || 'local';
  const canManageLocal = provider === 'local' || settings.allowLocalUploads || process.env.NODE_ENV !== 'production';

  return (
    <DashboardShell role="admin" title="Media Library">
      {searchParams?.uploaded && (
        <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm text-white">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-[#5EE4B3]" size={20} strokeWidth={1.8} />
            <div className="min-w-0">
              <p className="font-black text-[#5EE4B3]">Uploaded successfully</p>
              <code className="mt-2 block break-all rounded-md border border-[#2A3037] bg-[#050608] p-3 text-xs text-white">
                {searchParams.uploaded}
              </code>
            </div>
          </div>
        </div>
      )}

      {searchParams?.deleted && (
        <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">
          Media file deleted.
        </div>
      )}

      <section className="ui-panel overflow-hidden">
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2A3037] bg-[#101317] text-[#79C7FF]">
              <CloudUpload size={22} strokeWidth={1.8} />
            </div>
            <p className="mt-5 text-sm font-black uppercase tracking-wide text-[#79C7FF]">Asset operations</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">Upload, inspect, copy, and remove platform media</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#8A949E]">
              Upload images, PDFs, ZIP resources, and MP4 videos through the active storage adapter. Local assets appear below so admins can reuse URLs and clean unused files before launch.
            </p>
          </div>

          <form className="ui-panel-muted grid content-center gap-4 p-4" action="/api/admin/media" method="post" encType="multipart/form-data">
          <CsrfInput />
            <input type="hidden" name="_action" value="upload" />
            <label className="grid gap-2 text-sm font-bold text-[#D7DEE4]">
              Media file
              <input className="input" type="file" name="file" required />
              <span className="text-xs leading-5 text-[#8A949E]">Use production-like files when preparing the reviewer demo.</span>
            </label>
            <button className="btn-primary w-full sm:w-fit">Upload Media</button>
          </form>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {adapters.map((adapter) => {
          const Icon = adapter.icon;
          return (
            <article className="ui-panel p-5" key={adapter.label}>
              <Icon className="text-[#79C7FF]" size={22} strokeWidth={1.8} />
              <h3 className="mt-4 text-base font-black text-white">{adapter.label}</h3>
              <p className="mt-2 text-sm leading-6 text-[#8A949E]">{adapter.body}</p>
            </article>
          );
        })}
      </section>

      <section className="mt-6 border border-[#2F3336] bg-black">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2F3336] p-5">
          <div>
            <h2 className="text-xl font-black text-white">Local Asset Library</h2>
            <p className="mt-1 text-sm text-[#71767B]">{assets.length} recent local files. Remote S3/R2 assets are managed from the provider dashboard.</p>
          </div>
          <a className="btn-secondary" href="/admin/settings">Storage settings</a>
        </div>

        {assets.length ? (
          <div className="grid gap-0">
            {assets.map((asset) => (
              <div className="grid gap-3 border-b border-[#2F3336] p-4 last:border-b-0 lg:grid-cols-[90px_1fr_auto]" key={asset.url}>
                <div className="relative grid h-20 place-items-center border border-[#2F3336] bg-[#050608]">
                  {asset.type === 'image' ? (
                    <Image src={asset.url} alt="" fill sizes="90px" className="object-cover" unoptimized />
                  ) : (
                    <FileImage className="text-[#1D9BF0]" size={24} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-white">{asset.name}</p>
                  <code className="mt-2 block break-all text-xs text-[#1D9BF0]">{asset.url}</code>
                  <p className="mt-2 text-xs text-[#71767B]">
                    {asset.type.toUpperCase()} / {formatMediaSize(asset.size)} / {asset.updatedAt.toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <a className="btn-secondary" href={asset.url} target="_blank">Open</a>
                  {canManageLocal && (
                    <form action="/api/admin/media" method="post">
          <CsrfInput />
                      <input type="hidden" name="_action" value="delete" />
                      <input type="hidden" name="url" value={asset.url} />
                      <button className="btn-secondary border-red-400/40 text-red-200">
                        <Trash2 size={16} /> Delete
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <h3 className="text-lg font-black text-white">No local media yet</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#71767B]">
              Upload a file above to create a reusable media URL for pages, partners, certificates, course covers, and admin content.
            </p>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
