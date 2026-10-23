import { ok } from '@/lib/api';
import packageMetadata from '@/package.json';

const PRODUCT_NAME = 'Learnova Suite';
const EDITION = 'Open Source';

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

const releaseVersion =
  clean(process.env.NEXT_PUBLIC_APP_VERSION) ||
  clean(process.env.APP_VERSION) ||
  clean(packageMetadata.version) ||
  '1.0.0';

export async function GET() {
  return ok({
    name: PRODUCT_NAME,
    packageName: packageMetadata.name || 'learnova-suite',
    version: releaseVersion,
    edition: EDITION,
    buildTime: clean(process.env.NEXT_PUBLIC_BUILD_TIME) || clean(process.env.BUILD_TIME) || null,
    commit: clean(process.env.VERCEL_GIT_COMMIT_SHA)?.slice(0, 40) || clean(process.env.GIT_COMMIT)?.slice(0, 40) || null,
  });
}
