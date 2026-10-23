import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adminDir = path.join(root, 'app', 'admin');
const adminApiDir = path.join(root, 'app', 'api', 'admin');

const incompleteMarkers = [
  /coming soon/i,
  /not implemented/i,
  /demo only/i,
  /placeholder implementation/i,
  /not wired/i,
  /stub/i,
];

function walk(dir, fileName, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, fileName, files);
    else if (entry.name === fileName) files.push(fullPath);
  }
  return files;
}

function rel(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function routeFileFor(endpoint) {
  return path.join(root, 'app', endpoint.replace(/^\//, ''), 'route.ts');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function requireSourceIncludes(file, needle, message) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    findings.push(`${file}: missing required file.`);
    return;
  }
  if (!read(fullPath).includes(needle)) findings.push(`${file}: ${message}`);
}

const findings = [];
const pageFiles = walk(adminDir, 'page.tsx');
const routeFiles = walk(adminApiDir, 'route.ts');
const allowedExternalAdminFormActions = new Map([
  ['app/admin/payment-test/page.tsx', new Set(['/api/checkout'])],
]);

for (const pageFile of pageFiles) {
  const source = read(pageFile);
  const relativeFile = rel(pageFile);

  if (!/requireUser\(\['ADMIN'\]\)/.test(source)) {
    findings.push(`${relativeFile}: admin page is missing requireUser(['ADMIN']).`);
  }

  for (const marker of incompleteMarkers) {
    if (marker.test(source)) findings.push(`${relativeFile}: contains incomplete marker ${marker}.`);
  }

  for (const match of source.matchAll(/<form[\s\S]*?action=["']([^"']+)["'][\s\S]*?<\/form>/g)) {
    const endpoint = match[1];
    if (!endpoint.startsWith('/api/admin/')) {
      const allowed = allowedExternalAdminFormActions.get(relativeFile);
      if (!allowed?.has(endpoint) && !endpoint.startsWith('/admin/')) {
        findings.push(`${relativeFile}: admin form should post to /api/admin/* instead of ${endpoint}.`);
      }
      continue;
    }
    const routeFile = routeFileFor(endpoint);
    if (!fs.existsSync(routeFile)) {
      findings.push(`${relativeFile}: form posts to missing endpoint ${endpoint}.`);
      continue;
    }

    const routeSource = read(routeFile);
    for (const actionMatch of match[0].matchAll(/name=["'](_?action|intent)["'][\s\S]{0,180}?value=["']([^"']+)["']/g)) {
      const actionValue = actionMatch[2];
      if (!routeSource.includes(actionValue)) {
        findings.push(`${relativeFile}: form action ${actionMatch[1]}=${actionValue} is not handled by ${rel(routeFile)}.`);
      }
    }
  }

  for (const match of source.matchAll(/fetch\(["']([^"']+)["']/g)) {
    const endpoint = match[1];
    if (endpoint.startsWith('/api/admin/') && !fs.existsSync(routeFileFor(endpoint))) {
      findings.push(`${relativeFile}: client fetch points to missing endpoint ${endpoint}.`);
    }
  }
}

for (const routeFile of routeFiles) {
  const source = read(routeFile);
  const relativeFile = rel(routeFile);

  if (!/requireUser\(\['ADMIN'\]\)/.test(source)) {
    findings.push(`${relativeFile}: admin API route is missing requireUser(['ADMIN']).`);
  }

  if (/export async function POST/.test(source) && !/audit\(/.test(source)) {
    findings.push(`${relativeFile}: mutating admin API route should write an audit log entry.`);
  }

  for (const marker of incompleteMarkers) {
    if (marker.test(source)) findings.push(`${relativeFile}: contains incomplete marker ${marker}.`);
  }
}

const paymentRoute = read(path.join(root, 'app', 'api', 'admin', 'payment-methods', 'route.ts'));
const gatewayRuntime = read(path.join(root, 'lib', 'payment-gateways.ts'));
const paymentPage = read(path.join(root, 'app', 'admin', 'payment-methods', 'page.tsx'));
if (!paymentRoute.includes("providerType: 'offline'")) {
  findings.push('app/api/admin/payment-methods/route.ts: custom methods must be saved as offline providers.');
}
if (!gatewayRuntime.includes('isConfiguredOfflineGateway')) {
  findings.push('lib/payment-gateways.ts: checkout runtime must support custom offline payment methods.');
}
if (!paymentPage.includes('fully wired to the manual payment flow')) {
  findings.push('app/admin/payment-methods/page.tsx: admin instructions must explain custom method behavior.');
}

requireSourceIncludes('lib/features.ts', 'systemFeatureFlags', 'system feature flags must be documented and reusable.');
requireSourceIncludes('app/api/auth/register/route.ts', 'registration_closed', 'registration feature flag must control public registration.');
requireSourceIncludes('app/api/checkout/route.ts', 'checkout_disabled', 'checkout feature flag must control course checkout.');
requireSourceIncludes('app/api/cart/checkout/route.ts', 'checkout_disabled', 'checkout feature flag must control cart checkout.');
requireSourceIncludes('app/api/ai/assistant-chat/route.ts', 'smart_assistant_disabled', 'feature flag must control the smart assistant runtime.');
requireSourceIncludes('app/demo/page.tsx', 'public_demo_disabled', 'feature flag must control the public demo page.');
requireSourceIncludes('app/api/experiments/[key]/route.ts', 'getExperimentAssignment', 'A/B experiments must have a public assignment endpoint.');
requireSourceIncludes('app/admin/experiments/page.tsx', '/api/experiments/[key]', 'admin experiments page must explain the runtime endpoint.');
requireSourceIncludes('components/Footer.tsx', 'getPublicMobileAppLinks', 'mobile app admin settings must surface public app links.');
requireSourceIncludes('app/api/mobile-app/route.ts', 'getPublicMobileAppLinks', 'mobile app settings must expose a public API.');
requireSourceIncludes('app/embed/course/[slug]/page.tsx', 'allowedEmbedOrigin', 'embed widgets must enforce allowed domain settings.');
requireSourceIncludes('components/Footer.tsx', 'settings.footerNote', 'white-label footer note must render on the public footer.');
requireSourceIncludes('components/TrackingScripts.tsx', 'getPublicTrackingIntegrations', 'integration tracking settings must render public tracking scripts.');
requireSourceIncludes('components/TrackingScripts.tsx', 'shouldSkipTracking', 'public tracking scripts must be skipped on admin and account dashboards.');
requireSourceIncludes('components/ClientTrackingScripts.tsx', 'learnova_tracking_consent', 'public tracking scripts must wait for analytics cookie consent.');
requireSourceIncludes('components/CookieCategoryConsentButton.tsx', 'learnova-consent-change', 'cookie consent choices must notify tracking runtime.');
requireSourceIncludes('components/CookieConsentBanner.tsx', 'recordConsent', 'public cookie banner must record analytics consent choices.');
requireSourceIncludes('app/layout.tsx', 'CookieConsentBanner', 'root layout must mount the public cookie consent banner.');
requireSourceIncludes('proxy.ts', 'x-learnova-pathname', 'proxy must pass pathname context so tracking can stay public-only.');
requireSourceIncludes('app/layout.tsx', 'TrackingScripts', 'root layout must mount enabled public tracking integrations.');
requireSourceIncludes('lib/outbound-webhooks.ts', 'integrationSetting.findMany', 'integration webhook URLs must receive platform webhook events.');
requireSourceIncludes('lib/outbound-webhooks.ts', "provider === 'slack'", 'Slack integration webhooks must use a Slack-compatible payload.');
requireSourceIncludes('lib/api-key.ts', 'recordApiUsage', 'API key runtime must record usage for the admin usage page.');
requireSourceIncludes('app/api/public/courses/route.ts', 'requireApiKey', 'public API routes must use the central API key guard.');
requireSourceIncludes('app/api/public/courses/route.ts', 'recordApiUsage', 'public API routes must write usage logs.');
requireSourceIncludes('app/admin/support/page.tsx', 'responseSlaHrs', 'support queue must use active SLA policy thresholds.');
requireSourceIncludes('app/admin/support/page.tsx', 'Apply tag', 'support tags must be applicable to tickets from the queue.');
requireSourceIncludes('app/api/admin/support/route.ts', 'support.ticket.tag', 'support tag actions must persist and audit ticket tags.');
requireSourceIncludes('components/CookieCategoryConsentButton.tsx', 'saveConsent(false)', 'optional cookie categories must support explicit rejection.');
requireSourceIncludes('app/api/consent/route.ts', 'ip: requestIp(req)', 'consent records must capture request IP metadata when available.');
requireSourceIncludes('app/api/admin/cookie-categories/route.ts', 'cookie_category.enable', 'cookie category enable/disable actions must be audited.');
requireSourceIncludes('app/admin/consents/page.tsx', 'Delete type records', 'consent records admin page must support bulk cleanup by consent type.');
requireSourceIncludes('app/api/admin/consents/route.ts', 'consent.delete_type', 'bulk consent deletion must be audited.');
requireSourceIncludes('lib/addons.ts', 'Webhook signing secret', 'external webhook add-ons must expose a signing secret setting automatically.');
requireSourceIncludes('app/admin/app-marketplace/page.tsx', 'signed webhooks', 'add-ons center must explain real runtime hooks and signed webhooks.');
requireSourceIncludes('app/admin/surveys/page.tsx', 'Clear responses', 'surveys admin page must let admins clear collected responses without deleting the survey.');
requireSourceIncludes('app/admin/surveys/page.tsx', 'Open public form', 'surveys admin page must expose the public survey URL for QA and sharing.');
requireSourceIncludes('app/api/admin/surveys/route.ts', 'survey.responses.clear', 'survey response cleanup must be persisted and audited.');
requireSourceIncludes('app/surveys/[id]/page.tsx', "type === 'rating'", 'public surveys must render rating questions as rating controls.');
requireSourceIncludes('app/surveys/[id]/page.tsx', "type === 'boolean'", 'public surveys must render yes/no questions as boolean controls.');
requireSourceIncludes('app/api/surveys/respond/route.ts', 'Survey is closed', 'survey responses must reject inactive surveys.');
requireSourceIncludes('app/admin/email-templates/page.tsx', 'Rendered preview with sample data', 'email templates admin page must include a rendered preview, not only a textarea.');
requireSourceIncludes('app/admin/email-templates/page.tsx', 'CsrfInput', 'email template forms must include CSRF tokens.');
requireSourceIncludes('app/api/admin/email-templates/route.ts', 'verifyCsrf', 'email template updates must verify CSRF tokens.');
requireSourceIncludes('lib/backups.ts', 'listLocalBackupFiles', 'backup runtime must expose local backup files for admin management.');
requireSourceIncludes('app/admin/backups/page.tsx', 'Backup Files', 'backups admin page must display generated backup files, not only run logs.');
requireSourceIncludes('app/admin/backups/page.tsx', 'Download', 'backups admin page must allow admins to download generated backup files.');
requireSourceIncludes('app/api/admin/backups/route.ts', 'backup.file.delete', 'backup file deletion must be persisted and audited.');
requireSourceIncludes('app/api/admin/backups/route.ts', 'Content-Disposition', 'backup download endpoint must return files as attachments.');
requireSourceIncludes('app/admin/import/page.tsx', 'Catalog categories', 'import center must show current category state after imports.');
requireSourceIncludes('app/admin/import/page.tsx', 'Coupon codes', 'import center must show current coupon state after imports.');
requireSourceIncludes('app/admin/import/page.tsx', 'تطوير الويب', 'import center examples must use valid UTF-8 Arabic text.');
requireSourceIncludes('app/admin/jobs/page.tsx', 'Purge done', 'job queue admin page must allow cleanup of completed jobs.');
requireSourceIncludes('app/admin/jobs/page.tsx', 'payloadSummary', 'job queue admin page must expose job payload context for operations.');
requireSourceIncludes('app/api/admin/jobs/route.ts', 'job_queue.retry', 'job queue retry action must be persisted and audited.');
requireSourceIncludes('app/api/admin/jobs/route.ts', 'job_queue.delete', 'job queue delete action must be persisted and audited.');
requireSourceIncludes('app/admin/translation-jobs/page.tsx', 'Retry', 'translation jobs admin page must support retrying failed or review jobs.');
requireSourceIncludes('app/admin/translation-jobs/page.tsx', 'JSON.stringify(result', 'translation jobs admin page must show result payload details.');
requireSourceIncludes('app/admin/translation-jobs/page.tsx', 'Apply reviewed draft', 'translation jobs admin page must support applying reviewed drafts.');
requireSourceIncludes('app/api/admin/translation-jobs/route.ts', 'translation_job.retry', 'translation job retry action must be audited.');
requireSourceIncludes('app/api/admin/translation-jobs/route.ts', 'translation_job.apply', 'translation job approval/application must be audited.');
requireSourceIncludes('app/api/admin/translation-jobs/route.ts', 'translation_job.delete', 'translation job deletion must be audited.');
requireSourceIncludes('app/admin/content-rewrite/page.tsx', 'Apply rewritten copy', 'content rewrite admin page must support applying approved copy to target content.');
requireSourceIncludes('app/admin/content-rewrite/page.tsx', 'Optional target', 'content rewrite admin page must support selecting existing content as a source.');
requireSourceIncludes('app/api/admin/content-rewrite/route.ts', 'content_rewrite.apply', 'content rewrite apply action must be audited.');
requireSourceIncludes('app/api/admin/content-rewrite/route.ts', 'verifyCsrf', 'content rewrite mutations must verify CSRF tokens.');
requireSourceIncludes('app/admin/orders/page.tsx', '/api/admin/orders/status', 'orders admin page must support manual order status management beyond marking paid.');
requireSourceIncludes('app/admin/orders/page.tsx', 'Reopen', 'orders admin page must allow admins to reopen failed or cancelled orders.');
requireSourceIncludes('app/api/admin/orders/status/route.ts', 'order.status', 'manual order status changes must be audited.');
requireSourceIncludes('app/admin/license-activations/page.tsx', 'Manual activation', 'license activations admin page must support manual buyer activation.');
requireSourceIncludes('app/admin/license-activations/page.tsx', 'action\" value=\"update', 'license activations admin page must support editing activations.');
requireSourceIncludes('app/api/admin/license-activations/route.ts', 'licenseActivation.create', 'manual license activation creation must be audited.');
requireSourceIncludes('app/api/admin/license-activations/route.ts', 'licenseActivation.update', 'license activation edits must be audited.');
requireSourceIncludes('app/admin/waitlists/page.tsx', 'Bulk course actions', 'waitlists admin page must support course-level bulk operations.');
requireSourceIncludes('app/admin/waitlists/page.tsx', 'invite_course', 'waitlists admin page must allow inviting all waitlist entries for a course.');
requireSourceIncludes('app/api/admin/waitlists/route.ts', 'waitlist.invite_course', 'waitlist bulk invite action must be audited.');
requireSourceIncludes('app/api/admin/waitlists/route.ts', 'waitlist.delete_course', 'waitlist bulk delete action must be audited.');
requireSourceIncludes('app/admin/course-reports/page.tsx', 'Send to moderation', 'course reports admin page must allow escalating reports to moderation.');
requireSourceIncludes('app/admin/course-reports/page.tsx', 'value=\"delete', 'course reports admin page must support deleting handled reports.');
requireSourceIncludes('app/api/admin/course-reports/route.ts', 'course_report.queue', 'course report moderation escalation must be audited.');
requireSourceIncludes('app/api/admin/course-reports/route.ts', 'course_report.delete', 'course report deletion must be audited.');
requireSourceIncludes('app/admin/reviews/page.tsx', 'Edit moderation copy', 'reviews admin page must allow editing/moderating review text.');
requireSourceIncludes('app/admin/reviews/page.tsx', 'CsrfInput', 'reviews admin page mutating forms must include CSRF tokens.');
requireSourceIncludes('app/api/admin/reviews/route.ts', 'review.update', 'review moderation edits must be audited.');
requireSourceIncludes('app/api/admin/reviews/route.ts', 'verifyCsrf', 'review moderation mutations must verify CSRF tokens.');
requireSourceIncludes('app/admin/certificates/page.tsx', 'Manual certificate issue', 'certificates admin page must support issuing missing certificates.');
requireSourceIncludes('app/admin/certificates/page.tsx', 'Issue certificate', 'certificates admin page must expose a manual issue action.');
requireSourceIncludes('app/api/admin/certificates/route.ts', 'certificate.issue', 'manual certificate issue must be audited.');
requireSourceIncludes('app/admin/notifications/page.tsx', 'Manual in-app notification', 'notifications admin page must support sending platform notifications.');
requireSourceIncludes('app/admin/notifications/page.tsx', 'Send notification', 'notifications admin page must expose a manual send action.');
requireSourceIncludes('app/api/admin/notifications/route.ts', 'notification.create_bulk', 'manual notification sends must be audited.');
requireSourceIncludes('app/admin/messages/page.tsx', 'Reply as admin', 'messages admin page must support direct admin replies.');
requireSourceIncludes('app/api/admin/messages/route.ts', 'conversation.admin_reply', 'admin message replies must be audited.');
requireSourceIncludes('app/admin/onboarding/page.tsx', 'Add default launch sign-offs', 'onboarding wizard must create actionable launch sign-offs.');
requireSourceIncludes('app/admin/onboarding/page.tsx', 'Manual Sign-off', 'onboarding wizard must display manual release sign-offs.');
requireSourceIncludes('app/admin/onboarding/page.tsx', 'csrfToken', 'onboarding wizard mutating forms must include CSRF tokens.');
requireSourceIncludes('app/api/admin/onboarding/route.ts', 'onboarding.seed_launch_signoffs', 'onboarding launch sign-off seeding must be audited.');
requireSourceIncludes('app/api/admin/onboarding/route.ts', 'verifyCsrf', 'onboarding launch sign-off seeding must verify CSRF tokens.');
requireSourceIncludes('app/admin/nps/page.tsx', 'Export CSV', 'NPS admin page must support exporting feedback.');
requireSourceIncludes('app/admin/nps/page.tsx', 'Purge {segment}', 'NPS admin page must support segment cleanup.');
requireSourceIncludes('app/api/admin/nps/route.ts', 'nps.purge_segment', 'NPS segment cleanup must be audited.');
requireSourceIncludes('app/admin/export/page.tsx', 'Audit Logs CSV', 'export center must expose compliance/audit exports.');
requireSourceIncludes('app/admin/export/page.tsx', 'Login History CSV', 'export center must expose security login exports.');
requireSourceIncludes('app/admin/export/page.tsx', 'NPS Feedback CSV', 'export center must expose customer feedback exports.');
requireSourceIncludes('app/admin/quick-actions/page.tsx', 'One-click operations', 'quick actions page must expose backed operational actions.');
requireSourceIncludes('app/admin/quick-actions/page.tsx', '/api/admin/backups/run', 'quick actions page must include a backed backup action.');
requireSourceIncludes('app/admin/quick-actions/page.tsx', 'seed-launch-signoffs', 'quick actions page must include a backed launch checklist action.');
requireSourceIncludes('app/admin/quick-actions/page.tsx', 'CsrfInput', 'quick action mutating forms must include CSRF tokens.');
requireSourceIncludes('app/admin/system-metrics/page.tsx', 'Collect Snapshot', 'system metrics admin page must collect real runtime snapshots.');
requireSourceIncludes('app/admin/system-metrics/page.tsx', 'CsrfInput', 'system metrics mutating forms must include CSRF tokens.');
requireSourceIncludes('app/api/admin/system-metrics/route.ts', 'system_metric.collect_snapshot', 'system metric snapshot collection must be audited.');
requireSourceIncludes('app/api/admin/system-metrics/route.ts', 'verifyCsrf', 'system metric mutations must verify CSRF tokens.');
requireSourceIncludes('lib/production-readiness.ts', 'productionReadinessRows', 'production readiness checks must be reusable across install and admin screens.');
requireSourceIncludes('lib/production-readiness.ts', 'PostgreSQL database', 'production readiness must check PostgreSQL for live deployments.');
requireSourceIncludes('lib/production-readiness.ts', 'Live payment credentials', 'production readiness must check live payment provider credentials.');
requireSourceIncludes('app/admin/release-checklist/page.tsx', 'productionReadinessRows', 'release checklist must include reusable production preflight checks.');
requireSourceIncludes('app/admin/release-checklist/page.tsx', 'CsrfInput', 'release checklist mutating forms must include CSRF tokens.');
requireSourceIncludes('app/api/admin/release-checklist/route.ts', 'verifyCsrf', 'release checklist updates must verify CSRF tokens.');
requireSourceIncludes('app/admin/system-info/page.tsx', 'Production preflight', 'system info must expose production preflight status.');
requireSourceIncludes('app/admin/coupon-redemptions/page.tsx', 'Active reservations', 'coupon redemptions page must distinguish paid redemptions from active reservations.');
requireSourceIncludes('app/admin/coupon-redemptions/page.tsx', 'Clean expired reservations', 'coupon redemptions page must support cleanup of expired checkout reservations.');
requireSourceIncludes('app/api/admin/coupon-redemptions/route.ts', 'coupon_redemption.cleanup_expired_reservations', 'expired coupon reservation cleanup must be audited.');
requireSourceIncludes('app/admin/audit-logs/page.tsx', 'Audit filters', 'audit logs admin page must expose operational filters.');
requireSourceIncludes('app/admin/audit-logs/page.tsx', 'Purge old logs', 'audit logs admin page must expose retention cleanup.');
requireSourceIncludes('app/api/admin/audit-logs/route.ts', 'audit_logs.purge_old', 'audit log retention cleanup must be audited.');
requireSourceIncludes('app/api/admin/audit-logs/export/route.ts', 'auditWhere', 'audit log exports must respect UI filters.');
requireSourceIncludes('app/admin/automation-runs/page.tsx', 'Run selected rule', 'automation runs page must support manual rule execution.');
requireSourceIncludes('app/admin/automation-runs/page.tsx', 'Retry', 'automation runs page must support retrying failed executions.');
requireSourceIncludes('app/api/admin/automation-runs/route.ts', 'automationRun.retry', 'automation run retries must be audited.');
requireSourceIncludes('app/admin/api-usage/page.tsx', 'Top API paths', 'API usage admin page must include aggregate telemetry.');
requireSourceIncludes('app/api/admin/api-usage/route.ts', 'api_usage.export', 'API usage exports must be audited.');
requireSourceIncludes('app/admin/upload-test/page.tsx', 'Storage self-test', 'upload diagnostics must include a write/delete storage self-test.');
requireSourceIncludes('app/api/admin/upload-test/route.ts', 'upload_diagnostics.probe', 'upload diagnostics probe must be audited.');
requireSourceIncludes('app/admin/cache/page.tsx', 'getCsrfToken', 'cache admin client must receive a CSRF token.');
requireSourceIncludes('app/admin/cache/CacheManagementClient.tsx', 'x-csrf-token', 'cache JSON mutations must send CSRF tokens.');
requireSourceIncludes('app/api/admin/cache/route.ts', 'verifyCsrf', 'cache JSON mutations must verify CSRF tokens.');
requireSourceIncludes('app/api/admin/cache/clear/route.ts', 'verifyCsrf', 'cache clear action must verify CSRF tokens.');
requireSourceIncludes('app/admin/maintenance/page.tsx', '/api/admin/cache/clear', 'maintenance page must expose backed cache clear action.');
requireSourceIncludes('app/admin/reports/page.tsx', 'instructorId', 'reports page must support instructor filtering.');
requireSourceIncludes('app/admin/reports/page.tsx', 'categoryId', 'reports page must support category filtering.');
requireSourceIncludes('app/admin/reports/report-data.ts', 'filteredOrders', 'report revenue must be scoped to filtered order items.');
requireSourceIncludes('app/api/admin/reports/export/route.ts', 'categoryId', 'reports CSV export must preserve report filters.');
requireSourceIncludes('app/admin/recommendations/page.tsx', 'Visible to Students', 'recommendation rules must show learner impact preview.');
requireSourceIncludes('app/admin/recommendations/page.tsx', 'CsrfInput', 'recommendation rule forms must include CSRF tokens.');
requireSourceIncludes('app/api/admin/recommendations/route.ts', 'verifyCsrf', 'recommendation rule mutations must verify CSRF tokens.');

if (findings.length) {
  console.error('Admin completeness check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Admin completeness check passed. Reviewed ${pageFiles.length} admin pages and ${routeFiles.length} admin API routes.`);
