import { ok } from "@/lib/api";
import {
  mobileApiEndpointManifest,
  mobileApiSupportedRoles,
} from "@/lib/mobile-app-api-manifest";
import { getPublicMobileAppLinks } from "@/lib/mobile-app";
import { getSiteSettings } from "@/lib/site-settings";

export async function GET() {
  const [links, settings] = await Promise.all([
    getPublicMobileAppLinks(),
    getSiteSettings(),
  ]);

  return ok({
    name: `${settings.siteName} Mobile API`,
    version: "1.0.0",
    apiVersion: 1,
    supportedRoles: mobileApiSupportedRoles,
    endpoints: mobileApiEndpointManifest,
    links,
  });
}
