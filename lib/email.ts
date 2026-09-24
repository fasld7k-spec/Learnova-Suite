import { prisma } from '@/lib/prisma';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { getSiteSettings, type SiteSettings } from '@/lib/site-settings';
import net from 'net';
import tls from 'tls';

export type EmailTemplateLocale = {
  subject: string;
  html: string;
};

export type EmailTemplate = {
  key: string;
  name: string;
  subject: string;
  audience: string;
  trigger: string;
  description: string;
  variables: string[];
  html: string;
  /** Locale-specific overrides. When present, `renderEmailTemplate` uses the
   *  matching locale's subject/html instead of the top-level defaults. */
  locales?: Partial<Record<string, EmailTemplateLocale>>;
};

export const emailTemplates: EmailTemplate[] = [
  {
    key: 'purchase-confirmation',
    name: 'Purchase confirmation',
    subject: 'Your Learnova order is confirmed',
    audience: 'Student',
    trigger: 'order.paid',
    description: 'Sent after a paid order or free checkout enrolls the learner.',
    variables: ['studentName', 'courseTitle', 'invoiceNumber', 'dashboardUrl'],
    html: '<h1>Thanks, {{studentName}}</h1><p>Your access to {{courseTitle}} is ready. Invoice {{invoiceNumber}} is available from your dashboard.</p>'
  },
  {
    key: 'live-session-reminder',
    name: 'Live session reminder',
    subject: 'Live class starts soon',
    audience: 'Student',
    trigger: 'live_session.starts_soon',
    description: 'A reminder before a scheduled instructor session starts.',
    variables: ['studentName', 'sessionTitle', 'startsAt', 'joinUrl'],
    html: '<h1>{{sessionTitle}}</h1><p>Hi {{studentName}}, your session starts at {{startsAt}}. Use {{joinUrl}} to join.</p>'
  },
  {
    key: 'withdrawal-update',
    name: 'Withdrawal update',
    subject: 'Withdrawal request update',
    audience: 'Instructor',
    trigger: 'withdrawal.status_changed',
    description: 'Notifies instructors when payout requests are queued, approved, or rejected.',
    variables: ['instructorName', 'amount', 'status', 'adminNote'],
    html: '<h1>Withdrawal {{status}}</h1><p>{{instructorName}}, your {{amount}} withdrawal request has been updated. {{adminNote}}</p>'
  },
  {
    key: 'password-reset',
    name: 'Password reset',
    subject: 'Reset your Learnova password',
    audience: 'User',
    trigger: 'auth.password_reset_requested',
    description: 'Sent when a user requests account recovery.',
    variables: ['name', 'resetUrl', 'expiresIn'],
    html: '<h1>Password reset</h1><p>Use {{resetUrl}} within {{expiresIn}} to choose a new password.</p>'
  },
  {
    key: 'security-alert',
    name: 'Security alert',
    subject: 'Security alert for your Learnova account',
    audience: 'User',
    trigger: 'auth.security_alert',
    description: 'Sent when the platform detects a sensitive security event such as account lockout.',
    variables: ['name', 'event', 'ip', 'time'],
    html: '<h1>Security alert</h1><p>Hi {{name}}, {{event}}</p><p>IP address: {{ip}}<br/>Time: {{time}}</p><p>If this was not you, reset your password and contact support.</p>'
  },
  {
    key: 'certificate-issued',
    name: 'Certificate issued',
    subject: 'Your certificate is ready',
    audience: 'Student',
    trigger: 'certificate.issued',
    description: 'Confirms a generated certificate after course completion.',
    variables: ['studentName', 'courseTitle', 'certificateUrl'],
    html: '<h1>Congratulations, {{studentName}}</h1><p>Your certificate for {{courseTitle}} is ready at {{certificateUrl}}.</p>'
  },
  // ── 15 additional templates (Requirements 9.1) ──────────────────────────
  {
    key: 'welcome-email',
    name: 'Welcome email',
    subject: 'Welcome to {{siteName}}!',
    audience: 'User',
    trigger: 'user.registered',
    description: 'Sent within 60 seconds of account creation.',
    variables: ['name', 'siteName', 'dashboardUrl'],
    html: '<h1>Welcome, {{name}}!</h1><p>Your account on {{siteName}} is ready. <a href="{{dashboardUrl}}">Go to your dashboard</a>.</p>',
    locales: {
      ar: {
        subject: 'مرحباً بك في {{siteName}}!',
        html: '<h1>مرحباً {{name}}!</h1><p>حسابك على {{siteName}} جاهز. <a href="{{dashboardUrl}}">انتقل إلى لوحة التحكم</a>.</p>'
      }
    }
  },
  {
    key: 'email-verification',
    name: 'Email verification',
    subject: 'Verify your email address',
    audience: 'User',
    trigger: 'auth.email_registered',
    description: 'Sent on email/password registration with a 24-hour verification link.',
    variables: ['name', 'verificationUrl'],
    html: '<h1>Verify your email</h1><p>Hi {{name}}, click <a href="{{verificationUrl}}">here</a> to verify your email. Link expires in 24 hours.</p>',
    locales: {
      ar: {
        subject: 'تحقق من بريدك الإلكتروني',
        html: '<h1>تحقق من بريدك الإلكتروني</h1><p>مرحباً {{name}}، انقر <a href="{{verificationUrl}}">هنا</a> للتحقق من بريدك. الرابط صالح لمدة 24 ساعة.</p>'
      }
    }
  },
  {
    key: 'course-approved',
    name: 'Course approved',
    subject: 'Your course "{{courseTitle}}" has been approved',
    audience: 'Instructor',
    trigger: 'course.approved',
    description: 'Sent to the instructor when an admin approves their course.',
    variables: ['instructorName', 'courseTitle', 'courseUrl'],
    html: '<h1>Course Approved</h1><p>Hi {{instructorName}}, your course <strong>{{courseTitle}}</strong> has been approved and is now live. <a href="{{courseUrl}}">View course</a>.</p>',
    locales: {
      ar: {
        subject: 'تمت الموافقة على دورتك "{{courseTitle}}"',
        html: '<h1>تمت الموافقة على الدورة</h1><p>مرحباً {{instructorName}}، تمت الموافقة على دورتك <strong>{{courseTitle}}</strong> وهي الآن متاحة. <a href="{{courseUrl}}">عرض الدورة</a>.</p>'
      }
    }
  },
  {
    key: 'course-rejected',
    name: 'Course rejected',
    subject: 'Your course "{{courseTitle}}" needs revision',
    audience: 'Instructor',
    trigger: 'course.rejected',
    description: 'Sent to the instructor when an admin rejects their course, including the rejection reason.',
    variables: ['instructorName', 'courseTitle', 'rejectionReason', 'editUrl'],
    html: '<h1>Course Needs Revision</h1><p>Hi {{instructorName}}, your course <strong>{{courseTitle}}</strong> requires changes: {{rejectionReason}}. <a href="{{editUrl}}">Edit course</a>.</p>',
    locales: {
      ar: {
        subject: 'دورتك "{{courseTitle}}" تحتاج إلى مراجعة',
        html: '<h1>الدورة تحتاج إلى مراجعة</h1><p>مرحباً {{instructorName}}، دورتك <strong>{{courseTitle}}</strong> تحتاج إلى تعديلات: {{rejectionReason}}. <a href="{{editUrl}}">تعديل الدورة</a>.</p>'
      }
    }
  },
  {
    key: 'new-enrollment',
    name: 'New enrollment',
    subject: 'New student enrolled in "{{courseTitle}}"',
    audience: 'Instructor',
    trigger: 'enrollment.created',
    description: 'Sent to the instructor when a student enrolls in their course.',
    variables: ['instructorName', 'studentName', 'courseTitle', 'enrollmentsUrl'],
    html: '<h1>New Enrollment</h1><p>Hi {{instructorName}}, {{studentName}} just enrolled in <strong>{{courseTitle}}</strong>. <a href="{{enrollmentsUrl}}">View enrollments</a>.</p>',
    locales: {
      ar: {
        subject: 'طالب جديد في دورة "{{courseTitle}}"',
        html: '<h1>تسجيل جديد</h1><p>مرحباً {{instructorName}}، قام {{studentName}} بالتسجيل في <strong>{{courseTitle}}</strong>. <a href="{{enrollmentsUrl}}">عرض المسجلين</a>.</p>'
      }
    }
  },
  {
    key: 'review-received',
    name: 'Review received',
    subject: 'New review on "{{courseTitle}}"',
    audience: 'Instructor',
    trigger: 'review.created',
    description: 'Sent to the instructor when a student submits a review.',
    variables: ['instructorName', 'studentName', 'courseTitle', 'rating', 'comment', 'reviewsUrl'],
    html: '<h1>New Review</h1><p>Hi {{instructorName}}, {{studentName}} left a {{rating}}-star review on <strong>{{courseTitle}}</strong>: "{{comment}}". <a href="{{reviewsUrl}}">View reviews</a>.</p>',
    locales: {
      ar: {
        subject: 'تقييم جديد على دورة "{{courseTitle}}"',
        html: '<h1>تقييم جديد</h1><p>مرحباً {{instructorName}}، قام {{studentName}} بتقييم دورتك <strong>{{courseTitle}}</strong> بـ {{rating}} نجوم: "{{comment}}". <a href="{{reviewsUrl}}">عرض التقييمات</a>.</p>'
      }
    }
  },
  {
    key: 'question-answered',
    name: 'Question answered',
    subject: 'Your question has been answered',
    audience: 'Student',
    trigger: 'question.answered',
    description: 'Sent to the student when an instructor answers their question.',
    variables: ['studentName', 'instructorName', 'questionTitle', 'answer', 'questionUrl'],
    html: '<h1>Your Question Was Answered</h1><p>Hi {{studentName}}, {{instructorName}} answered your question "{{questionTitle}}": {{answer}}. <a href="{{questionUrl}}">View thread</a>.</p>',
    locales: {
      ar: {
        subject: 'تمت الإجابة على سؤالك',
        html: '<h1>تمت الإجابة على سؤالك</h1><p>مرحباً {{studentName}}، أجاب {{instructorName}} على سؤالك "{{questionTitle}}": {{answer}}. <a href="{{questionUrl}}">عرض الموضوع</a>.</p>'
      }
    }
  },
  {
    key: 'refund-approved',
    name: 'Refund approved',
    subject: 'Your refund has been processed',
    audience: 'Student',
    trigger: 'refund.approved',
    description: 'Sent to the student when a refund is approved.',
    variables: ['studentName', 'courseTitle', 'amount', 'currency', 'refundId'],
    html: '<h1>Refund Processed</h1><p>Hi {{studentName}}, your refund of {{amount}} {{currency}} for <strong>{{courseTitle}}</strong> has been processed. Reference: {{refundId}}.</p>',
    locales: {
      ar: {
        subject: 'تمت معالجة استرداد المبلغ',
        html: '<h1>تمت معالجة الاسترداد</h1><p>مرحباً {{studentName}}، تمت معالجة استرداد {{amount}} {{currency}} لدورة <strong>{{courseTitle}}</strong>. المرجع: {{refundId}}.</p>'
      }
    }
  },
  {
    key: 'subscription-expiring',
    name: 'Subscription expiring',
    subject: 'Your subscription expires in 7 days',
    audience: 'User',
    trigger: 'subscription.expiring_soon',
    description: 'Sent 7 days before a subscription expires.',
    variables: ['name', 'planName', 'expiresAt', 'renewUrl'],
    html: '<h1>Subscription Expiring Soon</h1><p>Hi {{name}}, your <strong>{{planName}}</strong> subscription expires on {{expiresAt}}. <a href="{{renewUrl}}">Renew now</a>.</p>',
    locales: {
      ar: {
        subject: 'اشتراكك ينتهي خلال 7 أيام',
        html: '<h1>اشتراكك على وشك الانتهاء</h1><p>مرحباً {{name}}، اشتراكك في <strong>{{planName}}</strong> ينتهي في {{expiresAt}}. <a href="{{renewUrl}}">جدد الآن</a>.</p>'
      }
    }
  },
  {
    key: 'instructor-payout',
    name: 'Instructor payout',
    subject: 'Your payout of {{amount}} {{currency}} has been processed',
    audience: 'Instructor',
    trigger: 'withdrawal.paid',
    description: 'Sent to the instructor when a payout is processed.',
    variables: ['instructorName', 'amount', 'currency', 'reference', 'payoutsUrl'],
    html: '<h1>Payout Processed</h1><p>Hi {{instructorName}}, your payout of {{amount}} {{currency}} has been processed. Reference: {{reference}}. <a href="{{payoutsUrl}}">View payouts</a>.</p>',
    locales: {
      ar: {
        subject: 'تمت معالجة مستحقاتك {{amount}} {{currency}}',
        html: '<h1>تمت معالجة المستحقات</h1><p>مرحباً {{instructorName}}، تمت معالجة مستحقاتك {{amount}} {{currency}}. المرجع: {{reference}}. <a href="{{payoutsUrl}}">عرض المستحقات</a>.</p>'
      }
    }
  },
  {
    key: 'support-ticket-reply',
    name: 'Support ticket reply',
    subject: 'New reply on your support ticket',
    audience: 'User',
    trigger: 'support_ticket.replied',
    description: 'Sent to the ticket creator when a support agent replies.',
    variables: ['name', 'ticketSubject', 'replyBody', 'ticketUrl'],
    html: '<h1>New Reply on Your Ticket</h1><p>Hi {{name}}, there is a new reply on your ticket "{{ticketSubject}}": {{replyBody}}. <a href="{{ticketUrl}}">View ticket</a>.</p>',
    locales: {
      ar: {
        subject: 'رد جديد على تذكرة الدعم الخاصة بك',
        html: '<h1>رد جديد على تذكرتك</h1><p>مرحباً {{name}}، يوجد رد جديد على تذكرتك "{{ticketSubject}}": {{replyBody}}. <a href="{{ticketUrl}}">عرض التذكرة</a>.</p>'
      }
    }
  },
  {
    key: 'course-announcement',
    name: 'Course announcement',
    subject: 'New announcement in "{{courseTitle}}"',
    audience: 'Student',
    trigger: 'course.announcement_posted',
    description: 'Sent to all enrolled students when an instructor posts an announcement.',
    variables: ['studentName', 'instructorName', 'courseTitle', 'announcementTitle', 'announcementBody', 'courseUrl'],
    html: '<h1>New Announcement</h1><p>Hi {{studentName}}, {{instructorName}} posted an announcement in <strong>{{courseTitle}}</strong>: <strong>{{announcementTitle}}</strong> — {{announcementBody}}. <a href="{{courseUrl}}">View course</a>.</p>',
    locales: {
      ar: {
        subject: 'إعلان جديد في دورة "{{courseTitle}}"',
        html: '<h1>إعلان جديد</h1><p>مرحباً {{studentName}}، نشر {{instructorName}} إعلاناً في دورة <strong>{{courseTitle}}</strong>: <strong>{{announcementTitle}}</strong> — {{announcementBody}}. <a href="{{courseUrl}}">عرض الدورة</a>.</p>'
      }
    }
  },
  {
    key: 'assignment-graded',
    name: 'Assignment graded',
    subject: 'Your assignment has been graded',
    audience: 'Student',
    trigger: 'assignment.graded',
    description: 'Sent to the student when an assignment is graded.',
    variables: ['studentName', 'assignmentTitle', 'grade', 'feedback', 'assignmentUrl'],
    html: '<h1>Assignment Graded</h1><p>Hi {{studentName}}, your assignment <strong>{{assignmentTitle}}</strong> received a grade of {{grade}}. Feedback: {{feedback}}. <a href="{{assignmentUrl}}">View assignment</a>.</p>',
    locales: {
      ar: {
        subject: 'تم تقييم واجبك',
        html: '<h1>تم تقييم الواجب</h1><p>مرحباً {{studentName}}، حصل واجبك <strong>{{assignmentTitle}}</strong> على درجة {{grade}}. الملاحظات: {{feedback}}. <a href="{{assignmentUrl}}">عرض الواجب</a>.</p>'
      }
    }
  },
  {
    key: 'quiz-passed',
    name: 'Quiz passed',
    subject: 'Congratulations! You passed the quiz',
    audience: 'Student',
    trigger: 'quiz.passed',
    description: 'Sent to the student when they pass a quiz.',
    variables: ['studentName', 'quizTitle', 'score', 'passingScore', 'courseTitle', 'courseUrl'],
    html: '<h1>Quiz Passed!</h1><p>Congratulations {{studentName}}! You scored {{score}}% on <strong>{{quizTitle}}</strong> (passing score: {{passingScore}}%) in {{courseTitle}}. <a href="{{courseUrl}}">Continue learning</a>.</p>',
    locales: {
      ar: {
        subject: 'تهانينا! لقد اجتزت الاختبار',
        html: '<h1>اجتزت الاختبار!</h1><p>تهانينا {{studentName}}! حصلت على {{score}}% في <strong>{{quizTitle}}</strong> (درجة النجاح: {{passingScore}}%) في دورة {{courseTitle}}. <a href="{{courseUrl}}">تابع التعلم</a>.</p>'
      }
    }
  },
  {
    key: 'goal-achieved',
    name: 'Goal achieved',
    subject: 'You achieved your learning goal!',
    audience: 'Student',
    trigger: 'learning_goal.completed',
    description: 'Sent to the student when they achieve a learning goal.',
    variables: ['studentName', 'goalTitle', 'dashboardUrl'],
    html: '<h1>Goal Achieved!</h1><p>Congratulations {{studentName}}! You have achieved your learning goal: <strong>{{goalTitle}}</strong>. <a href="{{dashboardUrl}}">View your progress</a>.</p>',
    locales: {
      ar: {
        subject: 'لقد حققت هدفك التعليمي!',
        html: '<h1>تحقق الهدف!</h1><p>تهانينا {{studentName}}! لقد حققت هدفك التعليمي: <strong>{{goalTitle}}</strong>. <a href="{{dashboardUrl}}">عرض تقدمك</a>.</p>'
      }
    }
  }
];

export async function getEditableEmailTemplates() {
  const row = await prisma.setting.findUnique({ where: { key: 'emailTemplates' } }).catch(() => null);
  const overrides = fromJsonObject<Record<string, Partial<EmailTemplate>>>(row?.value);
  return emailTemplates.map((template) => ({
    ...template,
    subject: String(overrides[template.key]?.subject || template.subject),
    html: String(overrides[template.key]?.html || template.html)
  }));
}

export async function saveEmailTemplateOverride(key: string, subject: string, html: string) {
  const template = emailTemplates.find((item) => item.key === key);
  if (!template) throw new Error('Email template not found.');
  const row = await prisma.setting.findUnique({ where: { key: 'emailTemplates' } }).catch(() => null);
  const current = fromJsonObject<Record<string, Partial<EmailTemplate>>>(row?.value);
  const next = { ...current, [key]: { subject: subject.trim() || template.subject, html: html.trim() || template.html } };
  await prisma.setting.upsert({
    where: { key: 'emailTemplates' },
    update: { value: toJson(next) },
    create: { key: 'emailTemplates', value: toJson(next) }
  });
}

export async function resetEmailTemplateOverride(key: string) {
  const template = emailTemplates.find((item) => item.key === key);
  if (!template) throw new Error('Email template not found.');
  const row = await prisma.setting.findUnique({ where: { key: 'emailTemplates' } }).catch(() => null);
  const current = fromJsonObject<Record<string, Partial<EmailTemplate>>>(row?.value);
  const next = { ...current };
  delete next[key];

  await prisma.setting.upsert({
    where: { key: 'emailTemplates' },
    update: { value: toJson(next) },
    create: { key: 'emailTemplates', value: toJson(next) }
  });
}

function renderTemplateValue(value: string, variables: Record<string, unknown>) {
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => String(variables[key] ?? ''));
}

export async function renderEmailTemplate(key: string, variables: Record<string, unknown>, locale?: string) {
  const template = (await getEditableEmailTemplates()).find((item) => item.key === key);
  if (!template) throw new Error('Email template not found.');
  const localeKey = locale && locale !== 'en' ? locale : undefined;
  const localeVariant = localeKey ? template.locales?.[localeKey] : undefined;
  return {
    subject: renderTemplateValue(localeVariant?.subject || template.subject, variables),
    html: renderTemplateValue(localeVariant?.html || template.html, variables)
  };
}

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  startTls: boolean;
  user: string;
  pass: string;
  from: string;
  ehloDomain: string;
  source: 'admin' | 'env';
};

function smtpConfigFromSettings(settings: SiteSettings): SmtpConfig | null {
  const adminHost = settings.smtpHost.trim();
  const envHost = process.env.SMTP_HOST || '';
  const host = adminHost || envHost;
  if (!host) return null;

  const usingAdmin = Boolean(adminHost);
  const secure = usingAdmin ? settings.smtpSecure : process.env.SMTP_SECURE === 'true';
  const port = Number(usingAdmin ? settings.smtpPort : process.env.SMTP_PORT || (secure ? 465 : 587));

  return {
    host,
    port: Number.isFinite(port) ? port : secure ? 465 : 587,
    secure,
    startTls: usingAdmin ? settings.smtpStartTls : process.env.SMTP_STARTTLS !== 'false',
    user: usingAdmin ? settings.smtpUser : process.env.SMTP_USER || '',
    pass: usingAdmin ? settings.smtpPassword : process.env.SMTP_PASS || '',
    from: usingAdmin ? settings.smtpSender : process.env.SMTP_FROM || process.env.SMTP_SENDER || settings.smtpSender || 'no-reply@learnova.test',
    ehloDomain: usingAdmin ? settings.smtpEhloDomain || 'localhost' : process.env.SMTP_EHLO_DOMAIN || 'localhost',
    source: usingAdmin ? 'admin' : 'env'
  };
}

function encodeHeader(value: string) {
  return /[^\x00-\x7F]/.test(value) ? `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=` : value;
}

function smtpEnvelope({ from, fromName, to, subject, html }: { from: string; fromName: string; to: string; subject: string; html: string }) {
  const boundary = `learnova-${Date.now()}`;
  return [
    `From: ${encodeHeader(fromName)} <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
    '.',
    ''
  ].join('\r\n');
}

async function sendSmtp({ to, subject, html, fromName, config }: { to: string; subject: string; html: string; fromName: string; config: SmtpConfig }) {
  let socket: net.Socket | tls.TLSSocket = config.secure
    ? tls.connect({ host: config.host, port: config.port, servername: config.host })
    : net.connect({ host: config.host, port: config.port });

  socket.setTimeout(15_000);

  const waitFor = (expected: number[]) =>
    new Promise<string>((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        const lastLine = text.trim().split(/\r?\n/).pop() || text;
        const code = Number(lastLine.slice(0, 3));
        if (!expected.includes(code)) {
          cleanup();
          reject(new Error(`SMTP expected ${expected.join('/')} but received: ${text.trim()}`));
          return;
        }
        if (lastLine[3] !== '-') {
          cleanup();
          resolve(text);
        }
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onTimeout = () => {
        cleanup();
        reject(new Error('SMTP connection timed out.'));
      };
      const cleanup = () => {
        socket.off('data', onData);
        socket.off('error', onError);
        socket.off('timeout', onTimeout);
      };
      socket.on('data', onData);
      socket.on('error', onError);
      socket.on('timeout', onTimeout);
    });

  const send = async (command: string, expected: number[]) => {
    socket.write(`${command}\r\n`);
    return waitFor(expected);
  };

  await waitFor([220]);
  await send(`EHLO ${config.ehloDomain}`, [250]);

  if (!config.secure && config.startTls) {
    await send('STARTTLS', [220]);
    socket = tls.connect({ socket, servername: config.host });
    await new Promise<void>((resolve, reject) => {
      socket.once('secureConnect', resolve);
      socket.once('error', reject);
    });
    await send(`EHLO ${config.ehloDomain}`, [250]);
  }

  if (config.user && config.pass) {
    await send('AUTH LOGIN', [334]);
    await send(Buffer.from(config.user).toString('base64'), [334]);
    await send(Buffer.from(config.pass).toString('base64'), [235]);
  }

  await send(`MAIL FROM:<${config.from}>`, [250]);
  await send(`RCPT TO:<${to}>`, [250, 251]);
  await send('DATA', [354]);
  socket.write(smtpEnvelope({ from: config.from, fromName, to, subject, html }));
  await waitFor([250]);
  await send('QUIT', [221]);
  socket.end();
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const settings = await getSiteSettings();
  const smtpConfig = smtpConfigFromSettings(settings);
  const requestedProvider = settings.emailProvider || process.env.EMAIL_PROVIDER || 'demo';
  const provider = requestedProvider === 'smtp' && smtpConfig ? 'smtp' : requestedProvider === 'smtp' ? 'demo' : requestedProvider;
  let status = provider === 'smtp' ? 'SENT' : 'QUEUED';
  const htmlPreview = html.replace(/\s+/g, ' ').slice(0, 140);
  let errorMessage: string | undefined;

  try {
    if (provider === 'smtp' && smtpConfig) {
      await sendSmtp({ to, subject, html, fromName: settings.siteName, config: smtpConfig });
    } else {
      console.log('Email queued', { to, subject, provider, htmlPreview });
    }
  } catch (error: any) {
    status = 'FAILED';
    errorMessage = error?.message || 'Email delivery failed';
  }

  await prisma.emailLog
    .create({
      data: {
        to,
        subject,
        status,
        meta: toJson({
          provider,
          mode: provider === 'smtp' ? 'smtp-delivery' : provider === 'log' ? 'log-only' : 'demo-log-only',
          smtpSource: smtpConfig?.source,
          htmlPreview,
          error: errorMessage
        })
      }
    })
    .catch(() => null);

  if (errorMessage && process.env.EMAIL_THROW_ON_FAIL === 'true') throw new Error(errorMessage);
  return { queued: status === 'QUEUED', provider, status };
}

/**
 * Send an email with up to 3 retry attempts.
 * On final failure, logs the failure with recipient, template name, and error details.
 * Requirements: 9.18
 */
export async function sendEmailWithRetry({
  to,
  subject,
  html,
  templateKey,
  maxAttempts = 3,
}: {
  to: string;
  subject: string;
  html: string;
  templateKey: string;
  maxAttempts?: number;
}): Promise<{ success: boolean; attempts: number }> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await sendEmail({ to, subject, html });
      if (result.status !== 'FAILED') {
        return { success: true, attempts: attempt };
      }
      lastError = 'Email delivery returned FAILED status';
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }

  // All attempts exhausted — log the failure (Requirement 9.18)
  console.error('[email] sendEmailWithRetry: all attempts failed', {
    recipient: to,
    templateName: templateKey,
    error: lastError,
    attempts: maxAttempts,
  });

  await prisma.emailLog
    .create({
      data: {
        to,
        subject,
        status: 'FAILED',
        meta: toJson({ templateKey, error: lastError, attempts: maxAttempts, finalFailure: true }),
      },
    })
    .catch(() => null);

  return { success: false, attempts: maxAttempts };
}

/**
 * Dispatch a templated email with retry logic.
 * Renders the template for the given locale, then calls sendEmailWithRetry.
 * Requirements: 9.2–9.18
 */
export async function dispatchEmail({
  to,
  templateKey,
  variables,
  locale,
}: {
  to: string;
  templateKey: string;
  variables: Record<string, unknown>;
  locale?: string;
}): Promise<{ success: boolean; attempts: number }> {
  const { subject, html } = await renderEmailTemplate(templateKey, variables, locale);
  return sendEmailWithRetry({ to, subject, html, templateKey });
}
