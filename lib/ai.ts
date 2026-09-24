import { getSiteSettings } from '@/lib/site-settings';
import { resolveAppUrl } from '@/lib/app-url';
import { prisma } from '@/lib/prisma';
import { assertSafeServerUrl } from '@/lib/egress-url';

type CourseOutline = {
  title: string;
  modules: { title: string; lessons: string[] }[];
  outcomes: string[];
};

type JsonRecord = Record<string, unknown>;

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantPageContext = {
  path?: string;
  title?: string;
};

const DEMO_AI_FALLBACK_NOTICE_EN = 'Demo/local AI fallback (not provider-generated).';
const DEMO_AI_FALLBACK_NOTICE_AR = '\u0648\u0636\u0639 \u062a\u062c\u0631\u064a\u0628\u064a/\u0645\u062d\u0644\u064a: \u0627\u0644\u0631\u062f \u063a\u064a\u0631 \u0645\u0648\u0644\u062f \u0645\u0646 \u0645\u0632\u0648\u062f AI \u062e\u0627\u0631\u062c\u064a.';

function fallbackCourseOutline(prompt: string): CourseOutline {
  const topic = prompt || 'New Course';
  return {
    title: `[Demo/local fallback] ${topic} Masterclass`,
    modules: [
      { title: 'Demo/local fallback plan', lessons: ['Review this generated sample before publishing', 'Replace sample structure with real curriculum details'] },
      { title: 'Introduction', lessons: ['Overview', 'Goals'] },
      { title: 'Core Concepts', lessons: ['Fundamentals', 'Practical Examples'] },
      { title: 'Final Project', lessons: ['Build', 'Review'] }
    ],
    outcomes: ['Demo/local fallback only; review before publishing', 'Understand the topic', 'Apply practical skills', 'Complete a project']
  };
}

export type AiProviderTestResult = {
  ok: boolean;
  provider: string;
  message: string;
};

async function endpointFor(provider: string, customEndpoint: string) {
  if (customEndpoint) {
    const safeEndpoint = await assertSafeServerUrl(customEndpoint, {
      label: 'AI endpoint',
      requireHttps: process.env.NODE_ENV === 'production',
    });
    return safeEndpoint.replace(/\/$/, '');
  }
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1/chat/completions';
  if (provider === 'deepseek') return 'https://api.deepseek.com/chat/completions';
  return 'https://api.openai.com/v1/chat/completions';
}

async function safeEndpointFor(provider: string, customEndpoint: string) {
  return endpointFor(provider, customEndpoint).catch(() => null);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function chatCompletionContent(data: unknown) {
  if (!isRecord(data) || !Array.isArray(data.choices)) return '';
  const [choice] = data.choices;
  if (!isRecord(choice) || !isRecord(choice.message)) return '';
  return typeof choice.message.content === 'string' ? choice.message.content : '';
}

function cleanStringList(value: unknown, max = 8) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, max);
}

function normalizeOutline(value: unknown, prompt: string): CourseOutline {
  const fallback = fallbackCourseOutline(prompt);
  const record = isRecord(value) ? value : {};
  const modules = Array.isArray(record.modules)
    ? record.modules
        .map((module) => {
          const moduleRecord = isRecord(module) ? module : {};
          return {
            title: String(moduleRecord.title || '').trim(),
            lessons: cleanStringList(moduleRecord.lessons),
          };
        })
        .filter((module): module is { title: string; lessons: string[] } => {
          return Boolean(module.title && module.lessons.length);
        })
        .slice(0, 8)
    : [];

  const outcomes = cleanStringList(record.outcomes);
  const title = typeof record.title === 'string' ? record.title.trim() : '';

  return {
    title: title || fallback.title,
    modules: modules.length ? modules : fallback.modules,
    outcomes: outcomes.length ? outcomes : fallback.outcomes
  };
}

function normalizeTone(tone: string) {
  const normalized = String(tone || '').trim().toLowerCase();
  if (['professional', 'friendly', 'marketing', 'academic'].includes(normalized)) return normalized;
  return 'professional';
}

function normalizeRewriteText(input: string) {
  return input
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

function ensureSentenceEnding(value: string) {
  return /[.!?)]$/.test(value) ? value : `${value}.`;
}

function fallbackRewriteContent(input: string, tone: string) {
  const text = ensureSentenceEnding(normalizeRewriteText(input));
  const normalizedTone = normalizeTone(tone);

  if (normalizedTone === 'friendly') {
    return `${DEMO_AI_FALLBACK_NOTICE_EN}\n\nHi there,\n\n${text}\n\nThanks for taking a look.`;
  }

  if (normalizedTone === 'marketing') {
    return `${DEMO_AI_FALLBACK_NOTICE_EN}\n\n${text}\n\nClear, practical, and ready to help learners move forward.`;
  }

  if (normalizedTone === 'academic') {
    return `${DEMO_AI_FALLBACK_NOTICE_EN}\n\n${text}\n\nThis version presents the information in a clear, structured, and evidence-conscious style.`;
  }

  return `${DEMO_AI_FALLBACK_NOTICE_EN}\n\nPlease note:\n\n${text}`;
}

export async function generateCourseOutline(prompt: string) {
  const settings = await getSiteSettings();
  if (!settings.aiEnabled || settings.aiProvider === 'demo' || !settings.aiApiKey) return fallbackCourseOutline(prompt);
  const endpoint = await safeEndpointFor(settings.aiProvider, settings.aiEndpoint);
  if (!endpoint) return fallbackCourseOutline(prompt);
  const appUrl = resolveAppUrl({ configured: settings.publicAppUrl });

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.aiApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': appUrl,
      'X-Title': settings.siteName
    },
    body: JSON.stringify({
      model: settings.aiModel || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Return only valid JSON with title, modules, and outcomes. modules must be an array of objects with title and lessons.'
        },
        {
          role: 'user',
          content: `Create a practical online course outline for: ${prompt}`
        }
      ]
    })
  }).catch(() => null);

  if (!response?.ok) return fallbackCourseOutline(prompt);

  const data: unknown = await response.json().catch(() => null);
  const content = chatCompletionContent(data);
  if (!content) return fallbackCourseOutline(prompt);

  try {
    return normalizeOutline(JSON.parse(content), prompt);
  } catch {
    return fallbackCourseOutline(prompt);
  }
}

export async function testAiProvider(): Promise<AiProviderTestResult> {
  const settings = await getSiteSettings();
  const provider = settings.aiProvider || 'demo';
  const appUrl = resolveAppUrl({ configured: settings.publicAppUrl });

  if (provider === 'demo') {
    return {
      ok: true,
      provider,
      message: 'Demo/local fallback generator is ready. Outputs are not provider-generated.'
    };
  }

  if (!settings.aiEnabled) {
    return {
      ok: false,
      provider,
      message: 'Enable AI tools before testing a live provider.'
    };
  }

  if (!settings.aiApiKey) {
    return {
      ok: false,
      provider,
      message: 'Add an API key before testing this provider.'
    };
  }

  if (provider === 'custom' && !settings.aiEndpoint) {
    return {
      ok: false,
      provider,
      message: 'Add a custom endpoint URL before testing the custom provider.'
    };
  }

  try {
    const endpoint = await endpointFor(provider, settings.aiEndpoint);
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.aiApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': appUrl,
        'X-Title': settings.siteName
      },
      body: JSON.stringify({
        model: settings.aiModel || 'gpt-4o-mini',
        max_tokens: 8,
        messages: [
          { role: 'system', content: 'Reply with OK only.' },
          { role: 'user', content: 'Connection test' }
        ]
      })
    });

    if (!response.ok) {
      const details = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 140);
      return {
        ok: false,
        provider,
        message: details ? `Provider returned ${response.status}: ${details}` : `Provider returned ${response.status}.`
      };
    }

    return {
      ok: true,
      provider,
      message: 'Provider connection test succeeded.'
    };
  } catch (error: unknown) {
    return {
      ok: false,
      provider,
      message: error instanceof Error && error.name === 'AbortError' ? 'Provider test timed out.' : 'Provider test could not reach the endpoint.'
    };
  }
}

export async function rewriteContent(input: string, tone: string) {
  const cleanInput = normalizeRewriteText(input);
  if (!cleanInput) return '';

  const normalizedTone = normalizeTone(tone);
  const fallback = fallbackRewriteContent(cleanInput, normalizedTone);
  const settings = await getSiteSettings();
  if (!settings.aiEnabled || settings.aiProvider === 'demo' || !settings.aiApiKey) return fallback;
  if (settings.aiProvider === 'custom' && !settings.aiEndpoint) return fallback;
  const endpoint = await safeEndpointFor(settings.aiProvider, settings.aiEndpoint);
  if (!endpoint) return fallback;

  const appUrl = resolveAppUrl({ configured: settings.publicAppUrl });
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.aiApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': appUrl,
      'X-Title': settings.siteName
    },
    body: JSON.stringify({
      model: settings.aiModel || 'gpt-4o-mini',
      max_tokens: Math.min(1800, Math.max(300, Math.ceil(cleanInput.length * 1.5))),
      messages: [
        {
          role: 'system',
          content: [
            'Rewrite the provided content in the requested tone.',
            'Preserve the original meaning, facts, links, names, numbers, and formatting intent.',
            'Return only the rewritten content with no labels, commentary, or markdown fences.'
          ].join(' ')
        },
        {
          role: 'user',
          content: `Tone: ${normalizedTone}\n\nContent:\n${cleanInput}`
        }
      ]
    })
  }).catch(() => null);

  if (!response?.ok) return fallback;

  const data: unknown = await response.json().catch(() => null);
  const content = chatCompletionContent(data).trim();
  return content.replace(/^```(?:\w+)?\s*|\s*```$/g, '').trim() || fallback;
}

export async function translateContent(input: string, locale: string) {
  const cleanInput = normalizeRewriteText(input);
  const targetLocale = String(locale || 'en').trim().toLowerCase();
  if (!cleanInput) return { text: '', provider: 'none', needsReview: false };

  const settings = await getSiteSettings();
  if (!settings.aiEnabled || settings.aiProvider === 'demo' || !settings.aiApiKey || (settings.aiProvider === 'custom' && !settings.aiEndpoint)) {
    return { text: cleanInput, provider: 'manual-draft', needsReview: true };
  }
  const endpoint = await safeEndpointFor(settings.aiProvider, settings.aiEndpoint);
  if (!endpoint) return { text: cleanInput, provider: settings.aiProvider, needsReview: true };

  const appUrl = resolveAppUrl({ configured: settings.publicAppUrl });
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.aiApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': appUrl,
      'X-Title': settings.siteName,
    },
    body: JSON.stringify({
      model: settings.aiModel || 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: Math.min(2200, Math.max(300, Math.ceil(cleanInput.length * 1.8))),
      messages: [
        {
          role: 'system',
          content: [
            `Translate the provided content to locale "${targetLocale}".`,
            'Preserve names, numbers, URLs, formatting intent, and HTML tags when present.',
            'Return only the translated content with no labels, notes, or markdown fences.',
          ].join(' '),
        },
        { role: 'user', content: cleanInput },
      ],
    }),
  }).catch(() => null);

  if (!response?.ok) return { text: cleanInput, provider: settings.aiProvider, needsReview: true };
  const data: unknown = await response.json().catch(() => null);
  const text = chatCompletionContent(data).trim().replace(/^```(?:\w+)?\s*|\s*```$/g, '').trim();
  return { text: text || cleanInput, provider: settings.aiProvider, needsReview: !text };
}

function truncate(value: string, max = 260) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function sanitizeAssistantText(value: string) {
  return String(value || '')
    .replace(/^```(?:\w+)?\s*|\s*```$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function prefersArabic(question: string, language?: string) {
  return String(language || '').toLowerCase().startsWith('ar') || /[\u0600-\u06FF]/.test(question);
}

function fallbackAssistantReply(question: string, context: string, language?: string) {
  const normalized = question.toLowerCase();
  const arabic = prefersArabic(question, language);
  const lines = [
    arabic ? DEMO_AI_FALLBACK_NOTICE_AR : DEMO_AI_FALLBACK_NOTICE_EN,
    '',
    arabic ? '\u0623\u0642\u062f\u0631 \u0623\u0633\u0627\u0639\u062f\u0643 \u0641\u064a \u0627\u0633\u062a\u062e\u062f\u0627\u0645 Learnova Suite.' : 'I can help you navigate Learnova Suite.',
    '',
  ];

  if (/course|learn|buy|checkout|payment/.test(normalized) || /\u0643\u0648\u0631\u0633|\u062f\u0648\u0631\u0629|\u062a\u0639\u0644\u0645|\u0634\u0631\u0627\u0621|\u062f\u0641\u0639|\u0627\u0634\u062a\u0631\u064a/.test(question)) {
    lines.push(
      arabic
        ? '\u0644\u0644\u0643\u0648\u0631\u0633\u0627\u062a\u060c \u0627\u0628\u062f\u0623 \u0645\u0646 /courses\u060c \u0627\u0641\u062a\u062d \u0635\u0641\u062d\u0629 \u0627\u0644\u0643\u0648\u0631\u0633\u060c \u0623\u0636\u0641\u0647 \u0644\u0644\u0633\u0644\u0629\u060c \u062b\u0645 \u0623\u0643\u0645\u0644 \u0645\u0646 \u0635\u0641\u062d\u0629 checkout. \u0641\u064a \u0648\u0636\u0639 \u0627\u0644\u062f\u064a\u0645\u0648 \u0627\u0644\u062f\u0641\u0639 \u0622\u0645\u0646 \u0648\u062a\u062c\u0631\u064a\u0628\u064a \u0641\u0642\u0637.'
        : 'For courses, start from /courses, open a course detail page, add it to the cart, then continue through checkout. In demo mode, the payment screen is a safe sandbox flow.'
    );
  } else if (/certificate|verify/.test(normalized) || /\u0634\u0647\u0627\u062f\u0629|\u062a\u062d\u0642\u0642/.test(question)) {
    lines.push(arabic ? '\u0644\u0644\u0634\u0647\u0627\u062f\u0627\u062a\u060c \u0627\u0633\u062a\u062e\u062f\u0645 /certificates/verify \u0644\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0643\u0648\u062f \u0627\u0644\u0634\u0647\u0627\u062f\u0629.' : 'For certificates, use /certificates/verify to check a certificate code, or open the student certificate area after completing eligible courses.');
  } else if (/instructor|teacher|course builder|builder/.test(normalized) || /\u0645\u062f\u0631\u0633|\u0645\u062f\u0631\u0628/.test(question)) {
    lines.push(arabic ? '\u0644\u0644\u0645\u062f\u0631\u0633\u064a\u0646\u060c \u0627\u0641\u062a\u062d /instructor \u0644\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0643\u0648\u0631\u0633\u0627\u062a\u060c \u0627\u0644\u0644\u0627\u064a\u0641 \u0633\u064a\u0634\u0646\u0632\u060c \u0627\u0644\u0645\u0648\u0627\u0631\u062f\u060c \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a\u060c \u0627\u0644\u0648\u0627\u062c\u0628\u0627\u062a\u060c \u0648\u0627\u0644\u0623\u0631\u0628\u0627\u062d.' : 'For instructors, sign in with the instructor account, open /instructor, then manage courses, live sessions, resources, quizzes, assignments, payouts, and student questions.');
  } else if (/admin|settings|dashboard/.test(normalized) || /\u0623\u062f\u0645\u0646|\u0627\u062f\u0645\u0646|\u0625\u062f\u0627\u0631\u0629|\u0627\u0639\u062f\u0627\u062f\u0627\u062a|\u0625\u0639\u062f\u0627\u062f\u0627\u062a/.test(question)) {
    lines.push(arabic ? '\u0644\u0644\u0625\u062f\u0627\u0631\u0629\u060c \u0627\u0633\u062a\u062e\u062f\u0645 /admin. \u0623\u0647\u0645 \u0635\u0641\u062d\u0627\u062a \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629: /admin/settings \u0648 /admin/courses \u0648 /admin/orders.' : 'For administration, use /admin. Key review pages include /admin/settings, /admin/courses, /admin/orders, /admin/payment-gateways, /admin/messages, and /admin/release-checklist.');
  } else if (/message|notification|support/.test(normalized) || /\u0631\u0633\u0627\u0644\u0629|\u0627\u0634\u0639\u0627\u0631|\u0625\u0634\u0639\u0627\u0631|\u062f\u0639\u0645/.test(question)) {
    lines.push(arabic ? '\u0644\u0644\u062a\u0648\u0627\u0635\u0644\u060c \u0627\u0633\u062a\u062e\u062f\u0645 /messages \u0648 /notifications \u0648 /support.' : 'For communication, use /messages, /notifications, /support, and the admin message/support queues to follow up with learners and instructors.');
  } else {
    lines.push(arabic ? '\u0627\u0633\u0623\u0644\u0646\u064a \u0639\u0646 \u0627\u0644\u0643\u0648\u0631\u0633\u0627\u062a\u060c \u0627\u0644\u062f\u0641\u0639\u060c \u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a\u060c \u0623\u062f\u0648\u0627\u062a \u0627\u0644\u0645\u062f\u0631\u0633\u060c \u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0623\u062f\u0645\u0646\u060c \u0627\u0644\u0631\u0633\u0627\u0626\u0644\u060c \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a\u060c \u0623\u0648 \u0627\u0644\u0646\u0634\u0631.' : 'Try asking about courses, checkout, certificates, instructor tools, admin setup, messages, notifications, live sessions, or deployment.');
  }

  lines.push('', arabic ? '\u0631\u0648\u0627\u0628\u0637 \u0645\u0641\u064a\u062f\u0629: /demo \u0648 /documentation \u0648 /courses \u0648 /help \u0648 /support.' : 'Useful starting points: /demo, /documentation, /courses, /help, /support.');
  if (context) lines.push('', (arabic ? '\u0633\u064a\u0627\u0642 \u0627\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u062d\u0627\u0644\u064a' : 'Current site context') + ': ' + truncate(context, 420));
  return lines.join('\n');
}

function formatAssistantPageContext(pageContext?: AssistantPageContext) {
  const rawPath = truncate(String(pageContext?.path || '').trim(), 180);
  const path = rawPath.startsWith('/') && !rawPath.startsWith('//') ? rawPath : '';
  const title = truncate(String(pageContext?.title || '').replace(/\s+/g, ' ').trim(), 140);
  if (!path && !title) return '';
  return `Current visitor page: ${path || 'unknown'}${title ? ` (${title})` : ''}.`;
}

async function buildAssistantContext(pageContext?: AssistantPageContext) {
  const [settings, courses, categories, liveSessions, kbArticles, pages, blogPosts] = await Promise.all([
    getSiteSettings(),
    prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        title: true,
        slug: true,
        shortDescription: true,
        level: true,
        language: true,
        isFree: true,
        price: true,
        salePrice: true,
        includesCertificate: true,
        category: { select: { nameEn: true, slug: true } },
        instructor: { select: { name: true } },
      },
    }).catch(() => []),
    prisma.category.findMany({ orderBy: { nameEn: 'asc' }, take: 12, select: { nameEn: true, slug: true } }).catch(() => []),
    prisma.liveSession.findMany({
      orderBy: { startsAt: 'asc' },
      take: 6,
      select: { title: true, startsAt: true, durationMinutes: true, provider: true, isPreview: true },
    }).catch(() => []),
    prisma.knowledgeBaseArticle.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { title: true, slug: true, category: true, body: true },
    }).catch(() => []),
    prisma.page.findMany({
      take: 8,
      select: { slug: true, titleEn: true, seoDescription: true },
    }).catch(() => []),
    prisma.blogPost.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { title: true, slug: true, excerpt: true },
    }).catch(() => []),
  ]);

  return [
    `Site: ${settings.siteName}. Tagline: ${settings.tagline}. Currency: ${settings.currency}. Language: ${settings.defaultLanguage}.`,
    formatAssistantPageContext(pageContext),
    `Core routes: /demo, /documentation, /courses, /cart, /checkout, /live-sessions, /certificates/verify, /messages, /notifications, /support, /admin, /instructor, /student.`,
    `Admin setup: AI provider is configured in /admin/settings. Payment gateways are in /admin/payment-gateways. Release readiness is in /admin/release-checklist.`,
    `Courses: ${courses.map((course) => `${course.title} (/courses/${course.slug}) by ${course.instructor.name}; ${course.category?.nameEn || 'General'}; ${course.isFree ? 'free' : `paid ${course.salePrice ?? course.price}`}; ${truncate(course.shortDescription, 140)}`).join(' | ') || 'No published courses yet.'}`,
    `Categories: ${categories.map((category) => `${category.nameEn} (/categories/${category.slug})`).join(', ') || 'No categories yet.'}`,
    `Live sessions: ${liveSessions.map((session) => `${session.title} on ${session.startsAt.toISOString()} via ${session.provider}${session.isPreview ? ' preview' : ''}`).join(' | ') || 'No live sessions listed.'}`,
    `Knowledge base: ${kbArticles.map((article) => `${article.title} (/knowledge-base/${article.slug}) [${article.category}] ${truncate(article.body, 120)}`).join(' | ') || 'No knowledge-base articles yet.'}`,
    `Pages: ${pages.map((page) => `${page.titleEn} (/${page.slug}) ${truncate(page.seoDescription || '', 80)}`).join(' | ') || 'No CMS pages yet.'}`,
    `Blog: ${blogPosts.map((post) => `${post.title} (/blog/${post.slug}) ${truncate(post.excerpt, 100)}`).join(' | ') || 'No published blog posts yet.'}`,
    `Local evaluation accounts can be seeded for admin, instructor, and student roles when preview data is enabled.`,
  ].filter(Boolean).join('\n');
}

export async function chatWithSiteAssistant(question: string, history: AssistantChatMessage[] = [], pageContext?: AssistantPageContext) {
  const cleanQuestion = truncate(question, 1200);
  if (!cleanQuestion) return 'Ask me about courses, checkout, certificates, live sessions, admin setup, or support.';

  const settings = await getSiteSettings();
  const context = await buildAssistantContext(pageContext);
  const provider = settings.aiProvider || 'demo';

  if (!settings.aiEnabled || provider === 'demo' || !settings.aiApiKey) {
    return fallbackAssistantReply(cleanQuestion, context, settings.defaultLanguage);
  }

  if (provider === 'custom' && !settings.aiEndpoint) {
    return fallbackAssistantReply(cleanQuestion, context, settings.defaultLanguage);
  }
  const endpoint = await safeEndpointFor(provider, settings.aiEndpoint);
  if (!endpoint) return fallbackAssistantReply(cleanQuestion, context, settings.defaultLanguage);

  const appUrl = resolveAppUrl({ configured: settings.publicAppUrl });
  const recentHistory = history
    .filter((message) => ['user', 'assistant'].includes(message.role) && message.content.trim())
    .slice(-8)
    .map((message) => ({ role: message.role, content: truncate(message.content, 900) }));

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.aiApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': appUrl,
      'X-Title': settings.siteName,
    },
    body: JSON.stringify({
      model: settings.aiModel || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'),
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: [
            `You are the embedded smart assistant for ${settings.siteName}.`,
            'Use the supplied site context to answer practically and accurately.',
            'Help users find pages, understand workflows, choose next actions, and troubleshoot common setup or marketplace questions.',
            'Mention exact internal routes when useful.',
            'If the user asks about admin-only configuration, explain where the admin should go without exposing secrets.',
            'Do not invent features that are not present in the context. If unsure, suggest /documentation or /support.',
            `Reply in the user's language when clear; otherwise reply in the site language (${settings.defaultLanguage}).`,
            'Keep answers concise and actionable.'
          ].join(' ')
        },
        { role: 'system', content: `Site context:\n${context}` },
        ...recentHistory,
        { role: 'user', content: cleanQuestion },
      ],
    }),
  }).catch(() => null);

  if (!response?.ok) return fallbackAssistantReply(cleanQuestion, context, settings.defaultLanguage);

  const data: unknown = await response.json().catch(() => null);
  const answer = sanitizeAssistantText(chatCompletionContent(data));
  return answer || fallbackAssistantReply(cleanQuestion, context, settings.defaultLanguage);
}
