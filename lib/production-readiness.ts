export function boolEnv(key: string) {
  return String(process.env[key] || '').toLowerCase() === 'true';
}

export function isUnsafeSecretValue(value: string | undefined) {
  const raw = String(value || '').trim().toLowerCase();
  return !raw || raw.includes('demo-only') || raw.includes('demo-') || raw.includes('replace-with') || raw.includes('change-before-production');
}

export function productionEnvReadiness() {
  const productionRuntime = process.env.NODE_ENV === 'production';
  const demoMode = boolEnv('DEMO_MODE');
  const sandboxPayments = boolEnv('PAYMENT_SANDBOX_MODE');
  const productionDemoPayments = boolEnv('ALLOW_PRODUCTION_DEMO_PAYMENTS');
  const jwtSecret = process.env.JWT_SECRET;
  const settingsEncryptionKey = process.env.SETTINGS_ENCRYPTION_KEY;
  const totpEncryptionKey = process.env.TOTP_ENCRYPTION_KEY;
  const contentProtectionSecret = process.env.CONTENT_PROTECTION_SECRET;
  const mediaAllowedHosts = String(process.env.MEDIA_ALLOWED_HOSTS || '').trim();
  const databaseUrl = String(process.env.DATABASE_URL || '');
  const storageProvider = String(process.env.STORAGE_PROVIDER || '').toLowerCase();
  const embedFrameAncestors = String(process.env.EMBED_FRAME_ANCESTORS || "'self'").trim();
  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  const smtpFrom = String(process.env.SMTP_FROM || '').trim();
  const emailProvider = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  const livePaymentKeys = [
    'STRIPE_SECRET_KEY',
    'PAYPAL_CLIENT_ID',
    'PAYMOB_API_KEY',
    'TAP_SECRET_KEY',
    'RAZORPAY_KEY_ID',
    'PAYSTACK_SECRET_KEY',
    'FLUTTERWAVE_SECRET_KEY',
    'MOLLIE_API_KEY',
    'MIDTRANS_SERVER_KEY',
    'XENDIT_SECRET_KEY',
    'SSLCOMMERZ_STORE_ID',
  ].some((key) => Boolean(String(process.env[key] || '').trim()));
  const bunnyValues = ['BUNNY_API_KEY', 'BUNNY_LIBRARY_ID', 'BUNNY_CDN_HOSTNAME', 'BUNNY_TOKEN_AUTH_KEY', 'BUNNY_WEBHOOK_SECRET']
    .map((key) => String(process.env[key] || '').trim());
  const bunnyPresent = bunnyValues.filter(Boolean).length;

  return {
    productionRuntime,
    demoMode,
    sandboxPayments,
    productionDemoPayments,
    mediaAllowedHosts,
    databaseUrl,
    storageProvider,
    embedFrameAncestors,
    jwtReady: Boolean(jwtSecret && jwtSecret.length >= 32 && (!productionRuntime || !isUnsafeSecretValue(jwtSecret))),
    settingsEncryptionReady: !productionRuntime || !isUnsafeSecretValue(settingsEncryptionKey),
    totpEncryptionReady: !productionRuntime || !isUnsafeSecretValue(totpEncryptionKey),
    contentProtectionReady: !productionRuntime || !isUnsafeSecretValue(contentProtectionSecret),
    productionSwitchesReady: !productionRuntime || (!demoMode && !sandboxPayments && !productionDemoPayments),
    mediaHostAllowlistReady: !productionRuntime || Boolean(mediaAllowedHosts),
    postgresReady: !productionRuntime || /^postgres(ql)?:\/\//i.test(databaseUrl),
    remoteStorageReady: !productionRuntime || ['s3', 'r2'].includes(storageProvider),
    localUploadsDisabled: !productionRuntime || !boolEnv('ALLOW_LOCAL_UPLOADS'),
    smtpReady: !productionRuntime || Boolean(smtpHost && smtpFrom),
    emailProviderReady: !productionRuntime || emailProvider !== 'demo',
    livePaymentReady: !productionRuntime || livePaymentKeys,
    embedFrameAncestorsReady: !productionRuntime || Boolean(embedFrameAncestors && embedFrameAncestors !== '*'),
    bunnyConfigReady: !productionRuntime || bunnyPresent === 0 || bunnyPresent === bunnyValues.length,
    bunnyWebhookReady: !productionRuntime || bunnyPresent === 0 || !isUnsafeSecretValue(process.env.BUNNY_WEBHOOK_SECRET),
  };
}

export function productionReadinessRows() {
  const env = productionEnvReadiness();
  return [
    {
      label: 'NODE_ENV=production',
      ready: env.productionRuntime,
      detail: `Current runtime: ${process.env.NODE_ENV || 'unset'}.`,
      nextStep: 'Set NODE_ENV=production on the live server.',
    },
    {
      label: 'PostgreSQL database',
      ready: env.postgresReady,
      detail: env.postgresReady ? 'DATABASE_URL uses PostgreSQL.' : 'Production should not use SQLite.',
      nextStep: 'Set DATABASE_URL to a PostgreSQL connection string and run npm run prisma:push:postgres before building.',
    },
    {
      label: 'Strong JWT secret',
      ready: env.jwtReady,
      detail: env.jwtReady ? 'JWT_SECRET is present and strong enough.' : 'JWT_SECRET is missing, short, or still a placeholder.',
      nextStep: 'Generate a long random JWT_SECRET.',
    },
    {
      label: 'Settings encryption',
      ready: env.settingsEncryptionReady,
      detail: env.settingsEncryptionReady ? 'SETTINGS_ENCRYPTION_KEY is ready.' : 'Admin provider secrets need an encryption key.',
      nextStep: 'Set SETTINGS_ENCRYPTION_KEY before saving live provider credentials.',
    },
    {
      label: '2FA encryption',
      ready: env.totpEncryptionReady,
      detail: env.totpEncryptionReady ? 'TOTP_ENCRYPTION_KEY is ready.' : 'Two-factor secrets need an encryption key.',
      nextStep: 'Set TOTP_ENCRYPTION_KEY before enabling 2FA in production.',
    },
    {
      label: 'Content protection secret',
      ready: env.contentProtectionReady,
      detail: env.contentProtectionReady ? 'CONTENT_PROTECTION_SECRET is ready.' : 'Signed protected media links need a secret.',
      nextStep: 'Set CONTENT_PROTECTION_SECRET to a long random value.',
    },
    {
      label: 'Live mode switches',
      ready: env.productionSwitchesReady,
      detail: `DEMO_MODE=${env.demoMode}; PAYMENT_SANDBOX_MODE=${env.sandboxPayments}; ALLOW_PRODUCTION_DEMO_PAYMENTS=${env.productionDemoPayments}.`,
      nextStep: 'Set DEMO_MODE=false, PAYMENT_SANDBOX_MODE=false, and ALLOW_PRODUCTION_DEMO_PAYMENTS=false.',
    },
    {
      label: 'Remote storage',
      ready: env.remoteStorageReady && env.localUploadsDisabled,
      detail: `STORAGE_PROVIDER=${env.storageProvider || 'unset'}; ALLOW_LOCAL_UPLOADS=${boolEnv('ALLOW_LOCAL_UPLOADS')}.`,
      nextStep: 'Use S3/R2 storage and keep local uploads disabled for live media.',
    },
    {
      label: 'Media host allowlist',
      ready: env.mediaHostAllowlistReady,
      detail: env.mediaAllowedHosts || 'No MEDIA_ALLOWED_HOSTS configured.',
      nextStep: 'Set MEDIA_ALLOWED_HOSTS to your CDN/video provider hostnames.',
    },
    {
      label: 'Embed frame ancestors',
      ready: env.embedFrameAncestorsReady,
      detail: env.embedFrameAncestors,
      nextStep: 'Use a specific EMBED_FRAME_ANCESTORS value instead of *.',
    },
    {
      label: 'Transactional email',
      ready: env.smtpReady && env.emailProviderReady,
      detail: `EMAIL_PROVIDER=${process.env.EMAIL_PROVIDER || 'unset'}; SMTP_HOST=${process.env.SMTP_HOST ? 'set' : 'missing'}.`,
      nextStep: 'Configure SMTP_HOST and SMTP_FROM with a real sender.',
    },
    {
      label: 'Live payment credentials',
      ready: env.livePaymentReady,
      detail: env.livePaymentReady ? 'At least one live payment provider key is configured.' : 'No live provider key detected.',
      nextStep: 'Configure at least one real payment provider or document manual-only launch.',
    },
    {
      label: 'Bunny Stream config',
      ready: env.bunnyConfigReady && env.bunnyWebhookReady,
      detail: env.bunnyConfigReady ? 'Bunny config is complete or disabled.' : 'Bunny config is partially filled.',
      nextStep: 'Set all Bunny variables together, including BUNNY_WEBHOOK_SECRET, or leave all empty.',
    },
  ];
}
