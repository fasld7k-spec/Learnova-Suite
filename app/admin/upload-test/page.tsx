import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { getSiteSettings } from '@/lib/site-settings';

export default async function UploadDiagnostics(props: { searchParams?: Promise<{ uploaded?: string; probe?: string; probeError?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const settings = await getSiteSettings();
  const provider = settings.storageProvider || 'local';
  const localAllowed = provider === 'local' && (settings.allowLocalUploads || process.env.NODE_ENV !== 'production');
  const remoteReady = ['s3', 'r2'].includes(provider) && Boolean(settings.storageBucket && settings.storageAccessKeyId && settings.storageSecretAccessKey);

  return (
    <DashboardShell role="admin" title="Upload Diagnostics">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm font-bold text-[#71767B]">Active provider</p>
          <p className="mt-2 text-2xl font-black text-white">{provider}</p>
        </div>
        <div className="card">
          <p className="text-sm font-bold text-[#71767B]">Local uploads</p>
          <Badge tone={localAllowed ? 'green' : 'red'}>{localAllowed ? 'Allowed' : 'Disabled'}</Badge>
        </div>
        <div className="card">
          <p className="text-sm font-bold text-[#71767B]">S3/R2 config</p>
          <Badge tone={remoteReady ? 'green' : 'yellow'}>{remoteReady ? 'Ready' : 'Missing keys'}</Badge>
        </div>
      </div>

      {searchParams?.uploaded && (
        <div className="mt-6 border border-[#00BA7C] bg-black p-4 text-sm text-white">
          Upload completed: <code className="break-all text-[#00BA7C]">{searchParams.uploaded}</code>
        </div>
      )}
      {searchParams?.probe && (
        <div className="mt-6 border border-[#00BA7C] bg-black p-4 text-sm font-bold text-[#D7FBE8]">
          Storage self-test passed: write and cleanup completed.
        </div>
      )}
      {searchParams?.probeError && (
        <div className="mt-6 border border-[#F4212E] bg-black p-4 text-sm font-bold text-[#F4212E]">
          {searchParams.probeError}
        </div>
      )}

      <form className="card mt-6" action="/api/admin/upload-test" method="post">
        <CsrfInput />
        <h2 className="text-xl font-bold text-white">Storage self-test</h2>
        <p className="mt-2 text-sm text-[#71767B]">Writes a tiny probe file through the active adapter and deletes it immediately.</p>
        <button className="btn-primary mt-4">Run storage self-test</button>
      </form>

      <form className="card mt-6" action="/api/admin/media" method="post" encType="multipart/form-data">
        <CsrfInput />
        <input type="hidden" name="_action" value="upload" />
        <input type="hidden" name="returnTo" value="upload-test" />
        <h2 className="text-xl font-bold text-white">Run upload check</h2>
        <p className="mt-2 text-sm text-[#71767B]">Uploads use the same storage adapter as course covers and media library assets.</p>
        <input className="input mt-5" type="file" name="file" />
        <button className="btn-primary mt-4">Upload test file</button>
      </form>
    </DashboardShell>
  );
}
