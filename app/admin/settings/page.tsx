import { Database, Globe2, KeyRound, Mail, Percent, Settings2, ShieldCheck, Sparkles } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getSiteSettings, linksToText } from '@/lib/site-settings';
import { languagePresets, localizedCopy, localizedDashboardLabel } from '@/lib/localized-copy';
import { CsrfInput } from '@/components/CsrfInput';

const socialDefaults = [
  { label: 'x', placeholder: 'https://x.com/yourbrand' },
  { label: 'linkedin', placeholder: 'https://linkedin.com/company/yourbrand' },
  { label: 'youtube', placeholder: 'https://youtube.com/@yourbrand' },
  { label: 'facebook', placeholder: 'https://facebook.com/yourbrand' }
];

function socialValue(links: { label: string; href: string }[], label: string) {
  return links.find((link) => link.label.toLowerCase() === label.toLowerCase())?.href || '';
}

export default async function Settings(
  props: {
    searchParams?: Promise<{ saved?: string; emailTest?: string; aiTest?: string; aiProvider?: string; aiMessage?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const [s, settings, languages] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'general' } }),
    getSiteSettings(),
    prisma.language.findMany({ orderBy: [{ active: 'desc' }, { code: 'asc' }] }).catch(() => [])
  ]);
  const v = fromJsonObject<any>(s?.value);
  const copy = localizedCopy(settings.defaultLanguage);
  const t = (label: string) => localizedDashboardLabel(label, settings.defaultLanguage);
  const socialLinks = settings.socialLinks;
  const languageOptions = languages.length
    ? languages
    : languagePresets.map((language) => ({ code: language.code, name: language.nativeName, direction: language.direction, active: language.code === settings.defaultLanguage }));

  return (
    <DashboardShell role="admin" title="General Settings">
      <form className="grid gap-6" action="/api/admin/settings" method="post">
          <CsrfInput />
        {searchParams?.saved === '1' ? (
          <div className="border border-[#1D9BF0] bg-[#06121d] px-4 py-3 text-sm font-bold text-white">
            {t('Settings saved successfully.')}
          </div>
        ) : null}

        {searchParams?.emailTest === 'sent' ? (
          <div className="border border-[#1D9BF0] bg-[#06121d] px-4 py-3 text-sm font-bold text-white">
            {t('Test email request was processed. Check Email Logs for the delivery result.')}
          </div>
        ) : null}

        {searchParams?.aiTest ? (
          <div className={`border px-4 py-3 text-sm font-bold text-white ${searchParams.aiTest === 'success' ? 'border-[#1D9BF0] bg-[#06121d]' : 'border-red-500 bg-[#2b0909]'}`}>
            {searchParams.aiTest === 'success'
              ? `${t('AI provider test succeeded for')} ${searchParams.aiProvider || t('the selected provider')}. ${searchParams.aiMessage || ''}`
              : `${t('AI provider test failed for')} ${searchParams.aiProvider || t('the selected provider')}. ${searchParams.aiMessage || t('Check the provider settings and try again.')}`}
          </div>
        ) : null}

        <section className="border border-[#2F3336] bg-black p-5">
          <div className="flex items-center gap-3">
            <Settings2 size={20} className="text-[#1D9BF0]" />
            <h2 className="text-xl font-black text-white">{t('Brand and platform')}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Fill these fields with your real brand, public domain, logo paths, and support contacts. The public URL is used in emails, certificates, OAuth redirects, webhooks, SEO links, and payment callbacks.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Site name')}<input className="input mt-2" name="siteName" defaultValue={v.siteName || 'Learnova Suite'} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Tagline')}<input className="input mt-2" name="tagline" defaultValue={v.tagline || settings.tagline} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Public site URL')}<input className="input mt-2" name="publicAppUrl" placeholder="https://your-domain.com" defaultValue={v.publicAppUrl || settings.publicAppUrl} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Official email')}<input className="input mt-2" name="officialEmail" type="email" defaultValue={v.officialEmail || 'support@your-domain.com'} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Logo URL')}<input className="input mt-2" name="logoUrl" defaultValue={v.logoUrl || ''} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Favicon URL')}<input className="input mt-2" name="faviconUrl" defaultValue={v.faviconUrl || '/icon.svg'} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Support phone')}<input className="input mt-2" name="supportPhone" defaultValue={v.supportPhone || '+1 555 0100'} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Support email')}<input className="input mt-2" name="supportEmail" type="email" defaultValue={v.supportEmail || 'support@your-domain.com'} /></label>
          </div>
        </section>

        <section className="border border-[#2F3336] bg-black p-5">
          <div className="flex items-center gap-3">
            <Globe2 size={20} className="text-[#1D9BF0]" />
            <h2 className="text-xl font-black text-white">{t('Localization and commerce')}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Choose the single active storefront language, its text direction, and the default currency code used by prices, invoices, checkout, reports, and certificates.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Currency')}<input className="input mt-2" name="currency" defaultValue={v.currency || 'USD'} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Default language')}
              <select className="input mt-2" name="defaultLanguage" defaultValue={settings.defaultLanguage}>
                {languageOptions.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.name} ({language.code.toUpperCase()} / {language.direction.toUpperCase()})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Primary color')}<input className="input mt-2" name="primaryColor" defaultValue={v.primaryColor || '#1D9BF0'} /></label>
            <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="rtl" defaultChecked={settings.rtl} /> {t('Enable RTL')}</label>
            <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="registrationEnabled" defaultChecked={v.registrationEnabled ?? true} /> {t('Registration enabled')}</label>
            <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="instructorsEnabled" defaultChecked={v.instructorsEnabled ?? true} /> {t('Instructor signup enabled')}</label>
          </div>
        </section>

        <section className="border border-[#2F3336] bg-black p-5">
          <div className="flex items-center gap-3">
            <Percent size={20} className="text-[#1D9BF0]" />
            <h2 className="text-xl font-black text-white">{t('Revenue and certificates')}</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Platform commission %')}<input className="input mt-2" name="platformCommission" type="number" min="0" max="100" defaultValue={v.platformCommission || 15} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Certificate issuer')}<input className="input mt-2" name="certificateIssuer" defaultValue={v.certificateIssuer || 'Learnova Suite'} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Certificate prefix')}<input className="input mt-2" name="certificatePrefix" defaultValue={v.certificatePrefix || 'CERT'} /></label>
          </div>
        </section>

        <section className="border border-[#2F3336] bg-black p-5">
          <div className="flex items-center gap-3">
            <Mail size={20} className="text-[#1D9BF0]" />
            <h2 className="text-xl font-black text-white">{t('Navigation, social, email, and payment')}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Navigation accepts one link per line in the format Label=/path. SMTP sends real transactional emails; Log only records messages in Email Logs without contacting an email server.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Header navigation')}<textarea className="input mt-2 min-h-44" name="navLinks" defaultValue={v.navLinks || linksToText(settings.navLinks)} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Footer navigation')}<textarea className="input mt-2 min-h-44" name="footerLinks" defaultValue={v.footerLinks || linksToText(settings.footerLinks)} /></label>
            <div className="grid gap-3 md:col-span-2">
              <p className="text-sm font-bold text-[#E7E9EA]">{t('Social links')}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {socialDefaults.map((item) => (
                  <label className="text-xs font-bold uppercase tracking-[0.12em] text-[#71767B]" key={item.label}>
                    {item.label}
                    <input className="input mt-2" name={`social_${item.label}`} placeholder={item.placeholder} defaultValue={socialValue(socialLinks, item.label)} />
                  </label>
                ))}
              </div>
            </div>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Payment notes')}<textarea className="input mt-2 min-h-24" name="paymentNotes" defaultValue={v.paymentNotes || copy.site.paymentNotes} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Email provider')}
              <select className="input mt-2" name="emailProvider" defaultValue={v.emailProvider || settings.emailProvider || 'smtp'}>
                <option value="smtp">{t('SMTP')}</option>
                <option value="log">{t('Log only')}</option>
              </select>
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('SMTP sender')}<input className="input mt-2" name="smtpSender" defaultValue={v.smtpSender || settings.smtpSender} /><span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Use the verified From address from SendGrid, Mailgun, SES, Brevo, or your SMTP mailbox.</span></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('SMTP host')}<input className="input mt-2" name="smtpHost" placeholder="smtp.example.com" defaultValue={v.smtpHost || settings.smtpHost} /><span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Enter the SMTP server hostname supplied by the email provider, for example smtp.sendgrid.net.</span></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('SMTP port')}<input className="input mt-2" name="smtpPort" type="number" min="1" max="65535" defaultValue={v.smtpPort || settings.smtpPort || 587} /><span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Use 587 for STARTTLS, 465 for SSL, or the exact port from the provider dashboard.</span></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('SMTP username')}<input className="input mt-2" name="smtpUser" autoComplete="username" defaultValue={v.smtpUser || settings.smtpUser} /><span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Usually an SMTP username or API key username; leave blank only if your provider allows it.</span></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('SMTP password')}
              <input className="input mt-2" name="smtpPassword" type="password" autoComplete="new-password" placeholder={v.smtpPassword || settings.smtpPassword ? t('Saved - leave blank to keep current password') : t('SMTP password')} />
              <span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Paste the SMTP password or API key. Existing saved secrets are kept when this field is left blank.</span>
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('SMTP EHLO domain')}<input className="input mt-2" name="smtpEhloDomain" defaultValue={v.smtpEhloDomain || settings.smtpEhloDomain || 'localhost'} /><span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Use your verified sending domain when available; localhost is acceptable for local testing.</span></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Test email recipient')}<input className="input mt-2" name="testEmailTo" type="email" defaultValue={settings.supportEmail} /><span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Send a test message to this address after saving to verify the current provider.</span></label>
            <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="smtpSecure" defaultChecked={v.smtpSecure ?? settings.smtpSecure} /> {t('Use SSL/TLS connection')}</label>
            <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="smtpStartTls" defaultChecked={v.smtpStartTls ?? settings.smtpStartTls} /> {t('Upgrade with STARTTLS when available')}</label>
          </div>
        </section>

        <section className="border border-[#2F3336] bg-black p-5">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-[#1D9BF0]" />
            <h2 className="text-xl font-black text-white">{t('AI assistant settings')}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Demo/local fallback works without keys for local previews and labels its output as not provider-generated. For production AI ideas, rewrites, and assistant replies, choose a provider, paste its API key, then use Save and test AI provider.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="aiEnabled" defaultChecked={v.aiEnabled ?? settings.aiEnabled} /> {t('Enable AI tools')}</label>
            <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="aiAssistantEnabled" defaultChecked={v.aiAssistantEnabled ?? settings.aiAssistantEnabled} /> {t('Show public smart assistant')}</label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('AI provider')}
              <select className="input mt-2" name="aiProvider" defaultValue={v.aiProvider || settings.aiProvider || 'demo'}>
                <option value="demo">{t('Demo generator')}</option>
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek</option>
                <option value="openrouter">OpenRouter</option>
                <option value="custom">{t('OpenAI-compatible custom endpoint')}</option>
              </select>
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('AI model')}<input className="input mt-2" name="aiModel" defaultValue={v.aiModel || settings.aiModel || 'gpt-4o-mini'} /><span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Use the model name from the selected provider, such as gpt-4o-mini, deepseek-chat, or an OpenRouter model id.</span></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('AI API key')}
              <input className="input mt-2" name="aiApiKey" type="password" autoComplete="new-password" placeholder={v.aiApiKey || settings.aiApiKey ? t('Saved - leave blank to keep current key') : t('Provider API key')} />
              <span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Paste the provider secret key. Existing saved keys remain unchanged when left blank.</span>
            </label>
            <label className="text-sm font-bold text-[#E7E9EA] md:col-span-2">{t('Custom endpoint')}
              <input className="input mt-2" name="aiEndpoint" placeholder="https://api.openai.com/v1/chat/completions" defaultValue={v.aiEndpoint || settings.aiEndpoint} />
              <span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Only required for custom/OpenAI-compatible providers. Leave empty for OpenAI, DeepSeek, or OpenRouter presets.</span>
            </label>
          </div>
        </section>

        <section className="border border-[#2F3336] bg-black p-5">
          <div className="flex items-center gap-3">
            <KeyRound size={20} className="text-[#1D9BF0]" />
            <h2 className="text-xl font-black text-white">{t('Social login settings')}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Add OAuth credentials for the built-in social login flow. If redirect URI is empty, the platform derives it from the public site URL.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Google client ID')}<input className="input mt-2" name="googleClientId" defaultValue={v.googleClientId || settings.googleClientId} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Google client secret')}
              <input className="input mt-2" name="googleClientSecret" type="password" autoComplete="new-password" placeholder={v.googleClientSecret || settings.googleClientSecret ? t('Saved - leave blank to keep current secret') : t('Google client secret')} />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA] md:col-span-2">{t('Google redirect URI')}<input className="input mt-2" name="googleRedirectUri" placeholder={t('/api/auth/oauth/google is derived automatically if empty')} defaultValue={v.googleRedirectUri || settings.googleRedirectUri} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('GitHub client ID')}<input className="input mt-2" name="githubClientId" defaultValue={v.githubClientId || settings.githubClientId} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('GitHub client secret')}
              <input className="input mt-2" name="githubClientSecret" type="password" autoComplete="new-password" placeholder={v.githubClientSecret || settings.githubClientSecret ? t('Saved - leave blank to keep current secret') : t('GitHub client secret')} />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA] md:col-span-2">{t('GitHub redirect URI')}<input className="input mt-2" name="githubRedirectUri" placeholder={t('/api/auth/oauth/github is derived automatically if empty')} defaultValue={v.githubRedirectUri || settings.githubRedirectUri} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Facebook app ID')}<input className="input mt-2" name="facebookClientId" defaultValue={v.facebookClientId || settings.facebookClientId} /></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Facebook app secret')}
              <input className="input mt-2" name="facebookClientSecret" type="password" autoComplete="new-password" placeholder={v.facebookClientSecret || settings.facebookClientSecret ? t('Saved - leave blank to keep current secret') : t('Facebook app secret')} />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA] md:col-span-2">{t('Facebook redirect URI')}<input className="input mt-2" name="facebookRedirectUri" placeholder={t('/api/auth/oauth/facebook is derived automatically if empty')} defaultValue={v.facebookRedirectUri || settings.facebookRedirectUri} /></label>
          </div>
        </section>

        <section className="border border-[#2F3336] bg-black p-5">
          <div className="flex items-center gap-3">
            <Database size={20} className="text-[#1D9BF0]" />
            <h2 className="text-xl font-black text-white">{t('Storage and uploads')}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Use local storage for development only, or connect S3/R2-compatible storage for production media, course covers, lesson resources, and protected uploads.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Storage provider')}
              <select className="input mt-2" name="storageProvider" defaultValue={v.storageProvider || settings.storageProvider || 'local'}>
                <option value="local">{t('Local demo storage')}</option>
                <option value="s3">{t('AWS S3 compatible')}</option>
                <option value="r2">{t('Cloudflare R2 compatible')}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="allowLocalUploads" defaultChecked={v.allowLocalUploads ?? settings.allowLocalUploads} /> {t('Allow local uploads in production')}</label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Bucket')}<input className="input mt-2" name="storageBucket" defaultValue={v.storageBucket || settings.storageBucket} /><span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Enter the exact S3/R2 bucket name that will store uploads.</span></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Region')}<input className="input mt-2" name="storageRegion" defaultValue={v.storageRegion || settings.storageRegion || 'auto'} /><span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Use the provider region, for example us-east-1, eu-central-1, or auto for Cloudflare R2.</span></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Access key ID')}<input className="input mt-2" name="storageAccessKeyId" autoComplete="username" defaultValue={v.storageAccessKeyId || settings.storageAccessKeyId} /><span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Paste the access key ID from your storage provider.</span></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Secret access key')}
              <input className="input mt-2" name="storageSecretAccessKey" type="password" autoComplete="new-password" placeholder={v.storageSecretAccessKey || settings.storageSecretAccessKey ? t('Saved - leave blank to keep current secret') : t('S3/R2 secret key')} />
              <span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Paste the storage secret key. Saved secrets are preserved when left blank.</span>
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Endpoint URL')}<input className="input mt-2" name="storageEndpoint" placeholder="https://account.r2.cloudflarestorage.com" defaultValue={v.storageEndpoint || settings.storageEndpoint} /><span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Required for R2 and custom S3-compatible providers. AWS S3 can usually leave it empty.</span></label>
            <label className="text-sm font-bold text-[#E7E9EA]">{t('Public base URL')}<input className="input mt-2" name="storagePublicBaseUrl" placeholder="https://cdn.example.com" defaultValue={v.storagePublicBaseUrl || settings.storagePublicBaseUrl} /><span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">Optional CDN or public bucket URL used when rendering uploaded media publicly.</span></label>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button className="btn-primary w-fit" name="intent" value="save">
            <ShieldCheck size={17} />
            {t('Save settings')}
          </button>
          <button className="inline-flex items-center gap-2 rounded-full border border-[#2F3336] px-5 py-3 text-sm font-black text-white transition hover:bg-[#16181C]" name="intent" value="test-email">
            <Mail size={17} />
            {t('Save and send test email')}
          </button>
          <button className="inline-flex items-center gap-2 rounded-full border border-[#2F3336] px-5 py-3 text-sm font-black text-white transition hover:bg-[#16181C]" name="intent" value="test-ai">
            <Sparkles size={17} />
            {t('Save and test AI provider')}
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
