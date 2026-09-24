import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const json = (value) => JSON.stringify(value);

async function main() {
  const [admin, instructor, student, buyer] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'admin@demo.com' } }),
    prisma.user.findUnique({ where: { email: 'instructor@demo.com' } }),
    prisma.user.findUnique({ where: { email: 'student@demo.com' } }),
    prisma.user.findUnique({ where: { email: 'buyer@demo.com' } }),
  ]);

  if (!admin || !instructor || !student) {
    throw new Error('Missing demo users. Run npm run prisma:seed before this script.');
  }

  const courses = await prisma.course.findMany({ where: { status: 'PUBLISHED' }, take: 6, orderBy: { createdAt: 'desc' } });
  if (!courses.length) throw new Error('Missing published demo courses. Run npm run prisma:seed before this script.');

  const primaryCourse = courses[0];
  const secondaryCourse = courses[1] || courses[0];
  const demoUsers = [admin.id, instructor.id, student.id, buyer?.id].filter(Boolean);

  await prisma.supportTicket.deleteMany({
    where: { subject: { in: ['Demo: Checkout receipt question', 'Demo: Instructor payout timing'] } },
  });
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: student.id,
      name: 'Omar Student',
      email: 'student@demo.com',
      subject: 'Demo: Checkout receipt question',
      message: 'I completed a sandbox checkout and want to confirm where invoices and certificates appear.',
      status: 'OPEN',
    },
  });
  await prisma.supportTicket.create({
    data: {
      userId: instructor.id,
      name: 'Sarah Instructor',
      email: 'instructor@demo.com',
      subject: 'Demo: Instructor payout timing',
      message: 'Please review the demo payout queue and expected approval workflow.',
      status: 'PENDING',
    },
  });
  await prisma.supportReply.deleteMany({ where: { ticketId: ticket.id } });
  await prisma.supportReply.create({
    data: {
      ticketId: ticket.id,
      adminId: admin.id,
      body: 'Demo reply: invoices live under Student > Invoices, and certificates appear after course completion.',
    },
  });

  await prisma.announcement.deleteMany({
    where: { title: { in: ['Demo onboarding week is live', 'New certificate templates available'] } },
  });
  await prisma.announcement.createMany({
    data: [
      {
        title: 'Demo onboarding week is live',
        body: 'Reviewers can test courses, checkout, messages, notifications, live sessions, and certificates from the prepared demo accounts.',
        audience: 'ALL',
        active: true,
      },
      {
        title: 'New certificate templates available',
        body: 'Admins can switch certificate templates and verify generated certificate pages from the certificate module.',
        audience: 'STUDENTS',
        active: true,
      },
    ],
  });

  await Promise.all([
    prisma.notificationPreference.upsert({
      where: { userId: student.id },
      update: { email: true, inApp: true, marketing: false, liveReminders: true },
      create: { userId: student.id, email: true, inApp: true, marketing: false, liveReminders: true },
    }),
    prisma.notificationPreference.upsert({
      where: { userId: instructor.id },
      update: { email: true, inApp: true, marketing: true, liveReminders: true },
      create: { userId: instructor.id, email: true, inApp: true, marketing: true, liveReminders: true },
    }),
    prisma.notificationPreference.upsert({
      where: { userId: admin.id },
      update: { email: true, inApp: true, marketing: false, liveReminders: false },
      create: { userId: admin.id, email: true, inApp: true, marketing: false, liveReminders: false },
    }),
  ]);
  await prisma.notification.deleteMany({
    where: {
      userId: { in: [student.id, instructor.id, admin.id] },
      title: {
        in: [
          'Demo certificate is almost ready',
          'Demo assignment feedback posted',
          'Demo payout batch approved',
          'Demo live room starts tomorrow',
          'Demo support SLA needs review',
          'Demo release checklist updated',
        ],
      },
    },
  });
  await prisma.notification.createMany({
    data: [
      {
        userId: student.id,
        title: 'Demo certificate is almost ready',
        body: 'Finish the capstone quiz to unlock the verified certificate preview.',
        read: false,
      },
      {
        userId: student.id,
        title: 'Demo assignment feedback posted',
        body: 'Your instructor added rubric notes to the SaaS launch checklist submission.',
        read: true,
      },
      {
        userId: instructor.id,
        title: 'Demo payout batch approved',
        body: 'The latest instructor payout is approved and visible in finance reports.',
        read: false,
      },
      {
        userId: instructor.id,
        title: 'Demo live room starts tomorrow',
        body: 'A confirmed learner booking is attached to your next live mentoring slot.',
        read: false,
      },
      {
        userId: admin.id,
        title: 'Demo support SLA needs review',
        body: 'One checkout receipt ticket is open with a linked staff reply and email log.',
        read: false,
      },
      {
        userId: admin.id,
        title: 'Demo release checklist updated',
        body: 'Hosted demo checks now include API health, email delivery, and certificate rendering.',
        read: true,
      },
    ],
  });

  await prisma.emailLog.deleteMany({
    where: {
      subject: {
        in: [
          'Demo certificate unlock reminder',
          'Demo instructor payout approved',
          'Demo admin support digest',
        ],
      },
    },
  });
  await prisma.emailLog.createMany({
    data: [
      {
        to: 'student@demo.com',
        subject: 'Demo certificate unlock reminder',
        status: 'SENT',
        meta: json({ template: 'certificate-reminder', courseId: primaryCourse.id, provider: 'demo-mail' }),
      },
      {
        to: 'instructor@demo.com',
        subject: 'Demo instructor payout approved',
        status: 'SENT',
        meta: json({ template: 'payout-approved', amount: 120, provider: 'demo-mail' }),
      },
      {
        to: 'admin@demo.com',
        subject: 'Demo admin support digest',
        status: 'QUEUED',
        meta: json({ template: 'support-digest', openTickets: 1, provider: 'demo-mail' }),
      },
    ],
  });

  await prisma.releaseChecklist.deleteMany({
    where: { title: { startsWith: 'Demo live readiness:' } },
  });
  await prisma.releaseChecklist.createMany({
    data: [
      { title: 'Demo live readiness: review admin notifications', done: true, sortOrder: 61 },
      { title: 'Demo live readiness: confirm instructor payout email', done: true, sortOrder: 62 },
      { title: 'Demo live readiness: verify student certificate reminder', done: false, sortOrder: 63 },
    ],
  });

  await prisma.taxRate.deleteMany({ where: { name: { in: ['Demo US Sales Tax', 'Demo EU VAT', 'Demo GCC VAT'] } } });
  await prisma.taxRate.createMany({
    data: [
      { name: 'Demo US Sales Tax', country: 'US', percent: 8.25, active: true },
      { name: 'Demo EU VAT', country: 'DE', percent: 19, active: true },
      { name: 'Demo GCC VAT', country: 'AE', percent: 5, active: true },
    ],
  });

  await prisma.conversation.deleteMany({ where: { subject: { in: ['Demo: Course project feedback', 'Demo: Support escalation'] } } });
  const conversation = await prisma.conversation.create({
    data: {
      subject: 'Demo: Course project feedback',
      userIds: json([student.id, instructor.id]),
      messages: {
        create: [
          { senderId: student.id, body: 'Hi Sarah, can you review my SaaS dashboard milestone before the live session?', read: true },
          { senderId: instructor.id, body: 'Absolutely. Upload your notes and I will respond before the next cohort call.', read: false },
        ],
      },
    },
  });
  await prisma.conversation.create({
    data: {
      subject: 'Demo: Support escalation',
      userIds: json([admin.id, student.id]),
      messages: {
        create: [
          { senderId: admin.id, body: 'Your demo support ticket is linked to this conversation for reviewer testing.', read: true },
          { senderId: student.id, body: 'Thanks, I can now see ticket context inside the message hub.', read: false },
        ],
      },
    },
  });

  await prisma.survey.deleteMany({ where: { title: { in: ['Demo Learner Experience Survey', 'Demo Instructor Tools Survey'] } } });
  const learnerSurvey = await prisma.survey.create({
    data: {
      title: 'Demo Learner Experience Survey',
      questions: json([
        { id: 'rating', type: 'scale', label: 'How useful was the demo learning flow?' },
        { id: 'checkout', type: 'choice', label: 'Was checkout easy to understand?', options: ['Yes', 'Somewhat', 'No'] },
        { id: 'comment', type: 'text', label: 'What should improve?' },
      ]),
      active: true,
    },
  });
  await prisma.survey.create({
    data: {
      title: 'Demo Instructor Tools Survey',
      questions: json([
        { id: 'publishing', type: 'scale', label: 'Rate course publishing clarity.' },
        { id: 'payouts', type: 'choice', label: 'Are payout controls clear?', options: ['Clear', 'Needs review'] },
      ]),
      active: true,
    },
  });
  await prisma.surveyResponse.deleteMany({ where: { surveyId: learnerSurvey.id, userId: student.id } });
  await prisma.surveyResponse.create({
    data: {
      surveyId: learnerSurvey.id,
      userId: student.id,
      answers: json({ rating: 9, checkout: 'Yes', comment: 'The course and certificate journey is easy to follow.' }),
    },
  });

  await Promise.all([
    prisma.featureFlag.upsert({
      where: { key: 'checkout_disabled' },
      update: { enabled: false, description: 'Blocks course, cart, bundle and subscription checkout flows while keeping browsing online.' },
      create: { key: 'checkout_disabled', enabled: false, description: 'Blocks course, cart, bundle and subscription checkout flows while keeping browsing online.' },
    }),
    prisma.featureFlag.upsert({
      where: { key: 'registration_closed' },
      update: { enabled: false, description: 'Stops new public account creation even when registration is enabled in site settings.' },
      create: { key: 'registration_closed', enabled: false, description: 'Stops new public account creation even when registration is enabled in site settings.' },
    }),
    prisma.featureFlag.upsert({
      where: { key: 'instructor_registration_closed' },
      update: { enabled: false, description: 'Stops new instructor signups while student registration can remain open.' },
      create: { key: 'instructor_registration_closed', enabled: false, description: 'Stops new instructor signups while student registration can remain open.' },
    }),
    prisma.featureFlag.upsert({
      where: { key: 'smart_assistant_disabled' },
      update: { enabled: false, description: 'Turns off the public smart assistant instantly without changing provider settings.' },
      create: { key: 'smart_assistant_disabled', enabled: false, description: 'Turns off the public smart assistant instantly without changing provider settings.' },
    }),
    prisma.featureFlag.upsert({
      where: { key: 'public_demo_disabled' },
      update: { enabled: false, description: 'Returns 404 for /demo even when DEMO_MODE is enabled for hosted demos.' },
      create: { key: 'public_demo_disabled', enabled: false, description: 'Returns 404 for /demo even when DEMO_MODE is enabled for hosted demos.' },
    }),
    prisma.featureFlag.upsert({
      where: { key: 'smart_assistant_public_widget' },
      update: { enabled: true, description: 'Shows the public smart assistant widget in the demo.' },
      create: { key: 'smart_assistant_public_widget', enabled: true, description: 'Shows the public smart assistant widget in the demo.' },
    }),
    prisma.featureFlag.upsert({
      where: { key: 'advanced_messages_v2' },
      update: { enabled: true, description: 'Enables the advanced message hub demo.' },
      create: { key: 'advanced_messages_v2', enabled: true, description: 'Enables the advanced message hub demo.' },
    }),
  ]);

  const org = await prisma.organization.upsert({
    where: { slug: 'northstar-academy' },
    update: { name: 'Northstar Academy', ownerId: admin.id, active: true },
    create: { name: 'Northstar Academy', slug: 'northstar-academy', ownerId: admin.id, active: true },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: student.id } },
    update: { role: 'LEARNER' },
    create: { organizationId: org.id, userId: student.id, role: 'LEARNER' },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: instructor.id } },
    update: { role: 'INSTRUCTOR' },
    create: { organizationId: org.id, userId: instructor.id, role: 'INSTRUCTOR' },
  });

  for (const [name, color] of [['Billing', '#0ea5e9'], ['Course access', '#22c55e'], ['Certificates', '#f59e0b']]) {
    await prisma.supportTag.upsert({ where: { name }, update: { color }, create: { name, color } });
  }

  await prisma.productUpdate.deleteMany({ where: { version: { in: ['1.0.1-demo', '1.0.2-demo'] } } });
  await prisma.productUpdate.createMany({
    data: [
      {
        version: '1.0.1-demo',
        title: 'Smart assistant and advanced messages',
        body: 'Added a site-aware assistant widget, advanced inbox flows, live notifications, and richer demo guidance.',
        published: true,
      },
      {
        version: '1.0.2-demo',
        title: 'Premium homepage theme refresh',
        body: 'Refreshed all six homepage themes with premium layouts, mobile visual QA, and stronger admin previews.',
        published: true,
      },
    ],
  });

  await prisma.seoRedirect.upsert({
    where: { fromPath: '/old-courses' },
    update: { toPath: '/courses', status: 301, active: true },
    create: { fromPath: '/old-courses', toPath: '/courses', status: 301, active: true },
  });
  await prisma.seoRedirect.upsert({
    where: { fromPath: '/classes' },
    update: { toPath: '/live-sessions', status: 302, active: true },
    create: { fromPath: '/classes', toPath: '/live-sessions', status: 302, active: true },
  });
  await prisma.seoMetaOverride.upsert({
    where: { path: '/courses' },
    update: {
      title: 'Learnova Suite Courses',
      description: 'Browse practical courses, live cohorts, certificates, and instructor-led programs.',
      image: '/images/og-courses.png',
    },
    create: {
      path: '/courses',
      title: 'Learnova Suite Courses',
      description: 'Browse practical courses, live cohorts, certificates, and instructor-led programs.',
      image: '/images/og-courses.png',
    },
  });

  const careerTrack = await prisma.careerTrack.upsert({
    where: { slug: 'full-stack-saas-builder' },
    update: {
      title: 'Full-Stack SaaS Builder',
      description: 'A demo career path combining web development, product thinking, checkout, and deployment.',
      skillIds: json(['nextjs', 'payments', 'dashboards', 'deployment']),
      active: true,
    },
    create: {
      title: 'Full-Stack SaaS Builder',
      slug: 'full-stack-saas-builder',
      description: 'A demo career path combining web development, product thinking, checkout, and deployment.',
      skillIds: json(['nextjs', 'payments', 'dashboards', 'deployment']),
      active: true,
    },
  });
  await prisma.careerTrackEnrollment.upsert({
    where: { careerTrackId_userId: { careerTrackId: careerTrack.id, userId: student.id } },
    update: { status: 'ACTIVE' },
    create: { careerTrackId: careerTrack.id, userId: student.id, status: 'ACTIVE' },
  });

  await prisma.jobBoardPost.deleteMany({ where: { title: { in: ['Junior SaaS Developer', 'Learning Experience Designer'] } } });
  const job = await prisma.jobBoardPost.create({
    data: {
      title: 'Junior SaaS Developer',
      company: 'Learnova Demo Studio',
      location: 'Remote',
      url: 'https://example.com/jobs/junior-saas-developer',
      description: 'Demo job post for learners completing the SaaS builder career track.',
      active: true,
    },
  });
  await prisma.jobBoardPost.create({
    data: {
      title: 'Learning Experience Designer',
      company: 'Northstar Academy',
      location: 'Hybrid',
      url: 'https://example.com/jobs/learning-designer',
      description: 'Demo role for product designers building structured online learning programs.',
      active: true,
    },
  });
  await prisma.jobApplication.upsert({
    where: { jobId_userId: { jobId: job.id, userId: student.id } },
    update: { status: 'SHORTLISTED', coverNote: 'Demo application connected to the learner portfolio.' },
    create: { jobId: job.id, userId: student.id, status: 'SHORTLISTED', coverNote: 'Demo application connected to the learner portfolio.' },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'enterprise-demo' },
    update: { name: 'Enterprise Demo Workspace', domain: null, active: true, settings: json({ seats: 48, plan: 'business-demo' }) },
    create: { name: 'Enterprise Demo Workspace', slug: 'enterprise-demo', domain: null, active: true, settings: json({ seats: 48, plan: 'business-demo' }) },
  });
  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
    update: { role: 'OWNER' },
    create: { tenantId: tenant.id, userId: admin.id, role: 'OWNER' },
  });
  await prisma.tenantCourse.upsert({
    where: { tenantId_courseId: { tenantId: tenant.id, courseId: primaryCourse.id } },
    update: { featured: true },
    create: { tenantId: tenant.id, courseId: primaryCourse.id, featured: true },
  });
  await prisma.tenantTheme.upsert({
    where: { tenantId: tenant.id },
    update: { logoUrl: '/icon.svg', primary: '#1d9bf0', secondary: '#0f172a' },
    create: { tenantId: tenant.id, logoUrl: '/icon.svg', primary: '#1d9bf0', secondary: '#0f172a' },
  });

  await prisma.pushNotificationCampaign.deleteMany({
    where: { title: { in: ['Demo live session reminder', 'Demo course completion nudge'] } },
  });
  await prisma.pushNotificationCampaign.createMany({
    data: [
      { title: 'Demo live session reminder', body: 'Your cohort session starts soon. Join from the live sessions page.', audience: 'STUDENTS', status: 'SENT' },
      { title: 'Demo course completion nudge', body: 'Finish the final lesson to unlock your certificate.', audience: 'STUDENTS', status: 'DRAFT' },
    ],
  });

  await prisma.partnerOffer.deleteMany({ where: { title: { in: ['Demo cloud credits', 'Demo design tool discount'] } } });
  await prisma.partner.deleteMany({ where: { name: { in: ['CloudLab Demo', 'DesignKit Demo'] } } });
  const cloudPartner = await prisma.partner.create({
    data: { name: 'CloudLab Demo', website: 'https://example.com/cloudlab', logoUrl: '/icon.svg', active: true },
  });
  const designPartner = await prisma.partner.create({
    data: { name: 'DesignKit Demo', website: 'https://example.com/designkit', logoUrl: '/icon.svg', active: true },
  });
  await prisma.partnerOffer.createMany({
    data: [
      { partnerId: cloudPartner.id, title: 'Demo cloud credits', description: 'Sandbox offer for SaaS learners deploying final projects.', url: 'https://example.com/cloudlab/offer', active: true },
      { partnerId: designPartner.id, title: 'Demo design tool discount', description: 'Sandbox partner offer for UI/UX course learners.', url: 'https://example.com/designkit/offer', active: true },
    ],
  });

  await prisma.grantApplication.deleteMany({
    where: { grantId: { in: (await prisma.grantProgram.findMany({ where: { title: 'Demo Career Switcher Grant' }, select: { id: true } })).map((item) => item.id) } },
  });
  await prisma.grantProgram.deleteMany({ where: { title: 'Demo Career Switcher Grant' } });
  const grant = await prisma.grantProgram.create({
    data: { title: 'Demo Career Switcher Grant', description: 'Sample grant program for learners who need financial support.', budget: 5000, active: true },
  });
  await prisma.grantApplication.upsert({
    where: { grantId_userId: { grantId: grant.id, userId: student.id } },
    update: { statement: 'Demo application for the career switcher grant.', status: 'APPROVED' },
    create: { grantId: grant.id, userId: student.id, statement: 'Demo application for the career switcher grant.', status: 'APPROVED' },
  });

  await prisma.scholarshipApplication.deleteMany({
    where: { scholarshipId: { in: (await prisma.scholarship.findMany({ where: { title: 'Demo Women in Tech Scholarship' }, select: { id: true } })).map((item) => item.id) } },
  });
  await prisma.scholarship.deleteMany({ where: { title: 'Demo Women in Tech Scholarship' } });
  const scholarship = await prisma.scholarship.create({
    data: { title: 'Demo Women in Tech Scholarship', description: 'Sample scholarship program with a 50% course discount.', percent: 50, active: true },
  });
  await prisma.scholarshipApplication.upsert({
    where: { scholarshipId_userId: { scholarshipId: scholarship.id, userId: student.id } },
    update: { statement: 'Demo scholarship application attached to the student account.', status: 'PENDING' },
    create: { scholarshipId: scholarship.id, userId: student.id, statement: 'Demo scholarship application attached to the student account.', status: 'PENDING' },
  });

  await prisma.vendorContract.deleteMany({ where: { title: { in: ['sample content licensing agreement', 'Demo live classroom SLA'] } } });
  await prisma.vendor.deleteMany({ where: { name: { in: ['StreamWorks Demo', 'CertifyPress Demo'] } } });
  const streamVendor = await prisma.vendor.create({
    data: { name: 'StreamWorks Demo', email: 'ops@example.com', website: 'https://example.com/streamworks', active: true },
  });
  const certifyVendor = await prisma.vendor.create({
    data: { name: 'CertifyPress Demo', email: 'certs@example.com', website: 'https://example.com/certifypress', active: true },
  });
  await prisma.vendorContract.createMany({
    data: [
      { vendorId: streamVendor.id, title: 'Demo live classroom SLA', fileUrl: '/docs/demo-live-classroom-sla.pdf', status: 'ACTIVE' },
      { vendorId: certifyVendor.id, title: 'sample content licensing agreement', fileUrl: '/docs/demo-content-license.pdf', status: 'REVIEW' },
    ],
  });

  await prisma.courseFaq.deleteMany({ where: { courseId: { in: [primaryCourse.id, secondaryCourse.id] } } });
  await prisma.courseFaq.createMany({
    data: [
      { courseId: primaryCourse.id, question: 'Do I get a certificate?', answer: 'Yes. Complete the required lessons and open Student > Certificates.', sortOrder: 1 },
      { courseId: primaryCourse.id, question: 'Can I test checkout safely?', answer: 'Yes. The demo uses sandbox checkout and mock payment screens.', sortOrder: 2 },
      { courseId: secondaryCourse.id, question: 'Are live sessions included?', answer: 'Live sessions are visible in the public live sessions page and student dashboard.', sortOrder: 1 },
    ],
  });

  await prisma.courseAnnouncement.deleteMany({ where: { courseId: { in: [primaryCourse.id, secondaryCourse.id] } } });
  await prisma.courseAnnouncement.createMany({
    data: [
      { courseId: primaryCourse.id, title: 'Demo project week is open', body: 'Submit the dashboard milestone before the next live class.' },
      { courseId: secondaryCourse.id, title: 'New downloadable checklist', body: 'A practical course checklist has been added to the resources area.' },
    ],
  });

  await prisma.webhookDelivery.deleteMany({ where: { event: { in: ['order.paid.demo', 'course.completed.demo'] } } });
  await prisma.webhookEndpoint.deleteMany({ where: { name: { in: ['Demo CRM webhook', 'Demo certificate webhook'] } } });
  const crmWebhook = await prisma.webhookEndpoint.create({
    data: { name: 'Demo CRM webhook', url: 'https://example.com/webhooks/crm', secret: 'demo-secret', active: true },
  });
  const certificateWebhook = await prisma.webhookEndpoint.create({
    data: { name: 'Demo certificate webhook', url: 'https://example.com/webhooks/certificates', secret: 'demo-secret', active: true },
  });
  await prisma.webhookDelivery.createMany({
    data: [
      { endpointId: crmWebhook.id, event: 'order.paid.demo', payload: json({ order: 'demo-paid-order', amount: 49 }), status: 'DELIVERED', response: '200 OK' },
      { endpointId: certificateWebhook.id, event: 'course.completed.demo', payload: json({ courseId: primaryCourse.id, userId: student.id }), status: 'PENDING', response: null },
    ],
  });

  const courseLessons = await prisma.lesson.findMany({
    where: { module: { courseId: primaryCourse.id } },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });
  const firstLesson = courseLessons[0] || null;
  let [firstAssignment, firstQuiz, firstOrder, welcomeCoupon] = await Promise.all([
    prisma.assignment.findFirst({ where: { courseId: primaryCourse.id } }),
    prisma.quiz.findFirst({ where: { lessonId: { in: courseLessons.map((lesson) => lesson.id) } } }),
    prisma.order.findFirst({ where: { userId: student.id }, orderBy: { createdAt: 'desc' } }),
    prisma.coupon.findFirst({ where: { code: 'WELCOME25' } }),
  ]);
  if (!firstAssignment) {
    firstAssignment = await prisma.assignment.create({
      data: {
        courseId: primaryCourse.id,
        lessonId: firstLesson?.id,
        title: 'Demo SaaS launch assignment',
        description: 'Submit a short launch checklist and dashboard screenshot for reviewer testing.',
        dueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
    });
  }
  if (!firstQuiz && firstLesson) {
    firstQuiz = await prisma.quiz.create({
      data: {
        lessonId: firstLesson.id,
        title: 'Demo SaaS readiness quiz',
        questions: json([
          { id: 'q1', type: 'choice', prompt: 'What should be tested before launching checkout?', options: ['Webhooks', 'Logo only', 'Footer text'], answer: 'Webhooks' },
          { id: 'q2', type: 'choice', prompt: 'Where should learners find proof of completion?', options: ['Certificates', 'Coupons', 'Tax rates'], answer: 'Certificates' },
        ]),
        passingScore: 70,
      },
    });
  }

  await prisma.auditLog.deleteMany({ where: { action: { startsWith: 'DEMO_' } } });
  await prisma.auditLog.createMany({
    data: [
      { actorId: admin.id, action: 'DEMO_THEME_REVIEWED', entity: 'Theme', entityId: 'theme-1', metadata: json({ status: 'approved' }), ip: '127.0.0.1' },
      { actorId: admin.id, action: 'DEMO_COURSE_APPROVED', entity: 'Course', entityId: primaryCourse.id, metadata: json({ queue: 'reviewer-demo' }), ip: '127.0.0.1' },
    ],
  });

  await prisma.adminNote.deleteMany({ where: { note: { startsWith: 'Demo note:' } } });
  await prisma.adminNote.createMany({
    data: [
      { entity: 'Course', entityId: primaryCourse.id, adminId: admin.id, note: 'Demo note: reviewer should check checkout, lesson access, and certificate issue.' },
      { entity: 'User', entityId: instructor.id, adminId: admin.id, note: 'Demo note: instructor profile, payout method, and live sessions are ready.' },
    ],
  });

  await prisma.apiKey.deleteMany({ where: { name: { in: ['Demo Reporting API', 'Demo Webhook API'] } } });
  await prisma.apiKey.createMany({
    data: [
      { name: 'Demo Reporting API', keyHash: 'demo_hash_reporting_only', active: true },
      { name: 'Demo Webhook API', keyHash: 'demo_hash_webhook_only', active: true },
    ],
  });
  await prisma.apiUsageLog.deleteMany({ where: { path: { startsWith: '/api/demo/' } } });
  await prisma.apiUsageLog.createMany({
    data: [
      { path: '/api/demo/reports', method: 'GET', status: 200 },
      { path: '/api/demo/webhooks', method: 'POST', status: 202 },
    ],
  });

  await prisma.webhookEvent.deleteMany({ where: { provider: 'demo' } });
  await prisma.webhookEvent.createMany({
    data: [
      { provider: 'demo', eventId: 'evt_demo_order_paid', payload: json({ type: 'order.paid', orderId: firstOrder?.id || 'demo-order' }), processed: true },
      { provider: 'demo', eventId: 'evt_demo_certificate_ready', payload: json({ type: 'certificate.ready', courseId: primaryCourse.id }), processed: false },
    ],
  });

  await prisma.automationRun.deleteMany({ where: { log: { startsWith: 'Demo automation' } } });
  await prisma.automationRule.deleteMany({
    where: { name: { in: ['Demo welcome notification', 'Demo certificate reminder', 'Demo paid order follow-up', 'Demo published course alert'] } },
  });
  await prisma.automationRule.create({
    data: {
      name: 'Demo paid order follow-up',
      trigger: 'order.paid',
      action: 'send.email',
      config: json({ target: 'student', message: 'Demo email template: send order follow-up for order {{orderId}}.' }),
      active: true,
    },
  });
  await prisma.automationRule.create({
    data: {
      name: 'Demo published course alert',
      trigger: 'course.published',
      action: 'create.notification',
      config: json({ target: 'admins', message: 'Demo notification: {{courseTitle}} was published by {{instructorName}}.' }),
      active: true,
    },
  });

  await prisma.backupLog.deleteMany({ where: { message: { startsWith: 'Demo backup' } } });
  await prisma.backupLog.createMany({
    data: [
      { type: 'DATABASE', status: 'SUCCESS', message: 'Demo backup completed for reviewer visibility.' },
      { type: 'FILES', status: 'SUCCESS', message: 'Demo backup archived media references.' },
    ],
  });

  await prisma.badgeAward.deleteMany({ where: { reason: { startsWith: 'Demo badge' } } });
  await prisma.badgeAward.createMany({
    data: [
      { userId: student.id, title: 'Demo Fast Starter', icon: 'sparkles', reason: 'Demo badge for completing onboarding.' },
      { userId: instructor.id, title: 'Demo Mentor', icon: 'award', reason: 'Demo badge for approved instructor readiness.' },
    ],
  });

  const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  await prisma.instructorAvailability.deleteMany({ where: { instructorId: instructor.id } });
  await prisma.instructorAvailability.createMany({
    data: [
      { instructorId: instructor.id, weekday: 2, startsAt: '10:00', endsAt: '12:00', timezone: 'UTC', active: true },
      { instructorId: instructor.id, weekday: 4, startsAt: '15:00', endsAt: '17:00', timezone: 'UTC', active: true },
    ],
  });
  await prisma.booking.deleteMany({ where: { meetingUrl: { startsWith: 'https://meet.example.com/demo' } } });
  await prisma.booking.create({
    data: { instructorId: instructor.id, studentId: student.id, startsAt, durationMin: 45, status: 'CONFIRMED', notes: 'Demo mentorship booking.', meetingUrl: 'https://meet.example.com/demo-booking' },
  });

  await prisma.calendarEvent.deleteMany({ where: { source: 'demo' } });
  await prisma.calendarEvent.createMany({
    data: [
      { userId: student.id, title: 'Demo live class', startsAt, endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000), source: 'demo', sourceId: primaryCourse.id },
      { userId: instructor.id, title: 'Demo project review', startsAt: new Date(startsAt.getTime() + 24 * 60 * 60 * 1000), endsAt: new Date(startsAt.getTime() + 25 * 60 * 60 * 1000), source: 'demo', sourceId: instructor.id },
    ],
  });

  await prisma.bulkEnrollmentInvite.deleteMany({ where: { token: { startsWith: 'demo-invite-' } } });
  await prisma.bulkEnrollmentInvite.createMany({
    data: [
      { email: 'team-member-one@example.com', courseId: primaryCourse.id, token: 'demo-invite-001', status: 'PENDING' },
      { email: 'team-member-two@example.com', courseId: secondaryCourse.id, token: 'demo-invite-002', status: 'ACCEPTED' },
    ],
  });

  const cart = await prisma.cart.upsert({
    where: { userId: buyer?.id || student.id },
    update: {},
    create: { userId: buyer?.id || student.id },
  });
  await prisma.cartItem.upsert({
    where: { cartId_courseId: { cartId: cart.id, courseId: primaryCourse.id } },
    update: {},
    create: { cartId: cart.id, courseId: primaryCourse.id },
  });

  await prisma.consentRecord.deleteMany({ where: { ip: '127.0.0.1' } });
  await prisma.consentRecord.createMany({
    data: [
      { userId: student.id, type: 'marketing', granted: true, ip: '127.0.0.1' },
      { userId: student.id, type: 'cookies.analytics', granted: true, ip: '127.0.0.1' },
    ],
  });
  for (const category of [
    { key: 'necessary', name: 'Necessary cookies', description: 'Required for login, checkout, and security.', required: true },
    { key: 'analytics', name: 'Analytics cookies', description: 'Helps admins understand demo page engagement.', required: false },
    { key: 'marketing', name: 'Marketing cookies', description: 'Used for campaign and affiliate attribution demos.', required: false },
  ]) {
    await prisma.cookieCategory.upsert({ where: { key: category.key }, update: category, create: category });
  }

  await prisma.contentModerationRule.deleteMany({ where: { pattern: { in: ['demo-banned-word', 'refund scam'] } } });
  await prisma.contentModerationRule.createMany({
    data: [
      { pattern: 'demo-banned-word', action: 'FLAG', active: true },
      { pattern: 'refund scam', action: 'HIDE', active: true },
    ],
  });
  await prisma.moderationQueueItem.deleteMany({ where: { reason: { startsWith: 'Demo moderation' } } });
  await prisma.moderationQueueItem.createMany({
    data: [
      { entity: 'Question', entityId: primaryCourse.id, reason: 'Demo moderation queue item for course Q&A.', status: 'PENDING' },
      { entity: 'Review', entityId: secondaryCourse.id, reason: 'Demo moderation queue item for review workflow.', status: 'APPROVED' },
    ],
  });

  await prisma.cohortEnrollment.deleteMany({ where: { userId: student.id } });
  await prisma.courseCohort.deleteMany({ where: { title: { startsWith: 'Demo ' } } });
  const cohort = await prisma.courseCohort.create({
    data: { courseId: primaryCourse.id, title: 'Demo SaaS Builder Cohort', startsAt, seats: 24 },
  });
  await prisma.cohortEnrollment.upsert({
    where: { cohortId_userId: { cohortId: cohort.id, userId: student.id } },
    update: {},
    create: { cohortId: cohort.id, userId: student.id },
  });

  await prisma.courseCollection.deleteMany({ where: { title: { startsWith: 'Demo ' } } });
  await prisma.courseCollection.create({
    data: { userId: student.id, title: 'Demo saved SaaS path', courseIds: json(courses.slice(0, 3).map((course) => course.id)) },
  });
  await prisma.wishlistCollection.deleteMany({ where: { title: { startsWith: 'Demo ' } } });
  await prisma.wishlistCollection.create({
    data: { userId: student.id, title: 'Demo public wishlist', courseIds: json(courses.slice(0, 4).map((course) => course.id)), public: true },
  });

  await prisma.courseImportJob.deleteMany({ where: { source: { startsWith: 'demo-' } } });
  await prisma.courseImportJob.create({ data: { source: 'demo-csv', payload: json({ rows: 12, type: 'courses' }), status: 'COMPLETED' } });
  await prisma.courseExportJob.deleteMany({ where: { fileUrl: { startsWith: '/exports/demo' } } });
  await prisma.courseExportJob.create({ data: { courseId: primaryCourse.id, format: 'CSV', status: 'COMPLETED', fileUrl: '/exports/demo-course-export.csv' } });

  await prisma.courseLicense.deleteMany({ where: { buyerId: { in: demoUsers } } });
  await prisma.courseLicense.create({ data: { courseId: primaryCourse.id, type: 'TEAM', seats: 12, buyerId: buyer?.id || student.id, active: true } });
  await prisma.courseMilestone.deleteMany({ where: { courseId: primaryCourse.id } });
  const milestone = await prisma.courseMilestone.create({ data: { courseId: primaryCourse.id, title: 'Product launch shipped', sortOrder: 1 } });
  await prisma.milestoneProgress.upsert({
    where: { milestoneId_userId: { milestoneId: milestone.id, userId: student.id } },
    update: { completed: true },
    create: { milestoneId: milestone.id, userId: student.id, completed: true },
  });

  await prisma.courseNote.deleteMany({ where: { userId: student.id, courseId: primaryCourse.id } });
  await prisma.courseNote.create({ data: { userId: student.id, courseId: primaryCourse.id, lessonId: firstLesson?.id, content: 'Demo note: remember to review the checkout webhook lesson.' } });
  await prisma.courseOutcomeSkill.deleteMany({ where: { courseId: primaryCourse.id } });
  await prisma.courseOutcomeSkill.createMany({
    data: [
      { courseId: primaryCourse.id, skill: 'Next.js app architecture', level: 'intermediate' },
      { courseId: primaryCourse.id, skill: 'Payment workflow QA', level: 'intermediate' },
    ],
  });
  if (courses[1]) {
    await prisma.coursePrerequisite.deleteMany({ where: { courseId: courses[1].id, prerequisiteCourseId: primaryCourse.id } });
    await prisma.coursePrerequisite.create({ data: { courseId: courses[1].id, prerequisiteCourseId: primaryCourse.id } });
  }
  await prisma.courseReport.deleteMany({ where: { userId: student.id, courseId: primaryCourse.id } });
  await prisma.courseReport.create({ data: { userId: student.id, courseId: primaryCourse.id, reason: 'Demo report: verify course moderation workflow.', status: 'REVIEWED' } });
  await prisma.courseResource.deleteMany({ where: { courseId: primaryCourse.id, title: { startsWith: 'Demo ' } } });
  await prisma.courseResource.createMany({
    data: [
      { courseId: primaryCourse.id, title: 'Demo launch checklist', url: '/docs/demo-launch-checklist.pdf', type: 'PDF' },
      { courseId: primaryCourse.id, title: 'Demo project repository', url: 'https://example.com/demo-repo', type: 'LINK' },
    ],
  });
  await prisma.courseTranslation.upsert({
    where: { courseId_locale: { courseId: primaryCourse.id, locale: 'ar' } },
    update: { title: 'دورة SaaS تجريبية', shortDescription: 'ترجمة عربية تجريبية لوصف الدورة.', fullDescription: 'محتوى تجريبي يوضح نظام ترجمة الكورسات.' },
    create: { courseId: primaryCourse.id, locale: 'ar', title: 'دورة SaaS تجريبية', shortDescription: 'ترجمة عربية تجريبية لوصف الدورة.', fullDescription: 'محتوى تجريبي يوضح نظام ترجمة الكورسات.' },
  });

  await prisma.dataRetentionPolicy.deleteMany({ where: { entity: { startsWith: 'demo.' } } });
  await prisma.dataRetentionPolicy.createMany({
    data: [
      { entity: 'demo.audit_logs', days: 365, active: true },
      { entity: 'demo.support_tickets', days: 730, active: true },
    ],
  });
  await prisma.dataExportRequest.deleteMany({ where: { userId: student.id } });
  await prisma.dataExportRequest.create({ data: { userId: student.id, status: 'COMPLETED', fileUrl: '/exports/demo-student-data.zip' } });
  await prisma.dataDeletionRequest.deleteMany({ where: { userId: buyer?.id || student.id } });
  await prisma.dataDeletionRequest.create({ data: { userId: buyer?.id || student.id, reason: 'Demo privacy request for reviewer workflow.', status: 'PENDING' } });

  await prisma.discussionTopic.deleteMany({ where: { title: { startsWith: 'Demo ' } } });
  const topic = await prisma.discussionTopic.create({
    data: { courseId: primaryCourse.id, userId: student.id, title: 'Demo project feedback thread', body: 'How should I structure the final SaaS dashboard project?', pinned: true },
  });
  await prisma.discussionReply.create({ data: { topicId: topic.id, userId: instructor.id, body: 'Start with dashboard metrics, then add billing and certificate workflows.' } });

  await prisma.domainVerification.deleteMany({ where: { domain: 'demo.learnova.example' } });
  await prisma.domainVerification.create({ data: { domain: 'demo.learnova.example', token: 'demo-domain-token', verified: true } });
  await prisma.abuseReport.deleteMany({ where: { targetId: { startsWith: 'demo-' } } });
  await prisma.abuseReport.createMany({
    data: [
      { reporterEmail: 'reviewer@example.com', targetType: 'COURSE', targetId: `demo-course-${primaryCourse.id}`, reason: 'Demo moderation report for course quality review.', status: 'RESOLVED' },
      { reporterEmail: 'student@example.com', targetType: 'MESSAGE', targetId: 'demo-message-thread', reason: 'Demo report showing message safety workflow.', status: 'OPEN' },
    ],
  });
  await prisma.dpaAgreement.deleteMany({ where: { company: 'Northstar Academy' } });
  await prisma.dpaAgreement.create({ data: { company: 'Northstar Academy', email: 'legal@example.com', status: 'SIGNED', fileUrl: '/docs/demo-dpa.pdf' } });
  await prisma.experiment.upsert({
    where: { key: 'demo_homepage_headline' },
    update: { variants: json([{ name: 'Outcome-led' }, { name: 'Marketplace-led' }]), active: true },
    create: { key: 'demo_homepage_headline', variants: json([{ name: 'Outcome-led' }, { name: 'Marketplace-led' }]), active: true },
  });
  await prisma.instructorApplicationNote.deleteMany({ where: { instructorId: instructor.id } });
  await prisma.instructorApplicationNote.create({ data: { instructorId: instructor.id, adminId: admin.id, note: 'Demo instructor is approved and ready for reviewer testing.' } });
  await prisma.instructorBadge.deleteMany({ where: { instructorId: instructor.id } });
  await prisma.instructorBadge.create({ data: { instructorId: instructor.id, title: 'Demo Live Mentor', icon: 'video', reason: 'Runs live classes in the demo marketplace.' } });
  await prisma.instructorPayoutMethod.deleteMany({ where: { instructorId: instructor.id } });
  await prisma.instructorPayoutMethod.create({ data: { instructorId: instructor.id, method: 'Bank transfer', details: json({ bank: 'Demo Bank', last4: '4242' }), active: true } });
  await prisma.instructorReview.upsert({
    where: { instructorId_userId: { instructorId: instructor.id, userId: student.id } },
    update: { rating: 5, comment: 'Demo review for instructor profile depth.' },
    create: { instructorId: instructor.id, userId: student.id, rating: 5, comment: 'Demo review for instructor profile depth.' },
  });

  await prisma.invoiceTemplate.deleteMany({ where: { name: 'Demo Invoice Template' } });
  await prisma.invoiceTemplate.create({ data: { name: 'Demo Invoice Template', html: '<h1>{{invoiceNumber}}</h1><p>{{total}}</p>', active: true } });
  await prisma.jobQueue.deleteMany({ where: { type: { startsWith: 'demo.' } } });
  await prisma.jobQueue.createMany({
    data: [
      { type: 'demo.email.digest', payload: json({ audience: 'students' }), status: 'COMPLETED', attempts: 1 },
      { type: 'demo.certificate.render', payload: json({ courseId: primaryCourse.id }), status: 'PENDING', attempts: 0 },
    ],
  });
  await prisma.learningGoal.deleteMany({ where: { userId: student.id, title: { startsWith: 'Demo ' } } });
  await prisma.learningGoal.create({ data: { userId: student.id, title: 'Demo finish SaaS course', target: 100, progress: 72, dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) } });
  const path = await prisma.learningPath.upsert({
    where: { slug: 'demo-saas-launch-path' },
    update: { title: 'Demo SaaS Launch Path', description: 'A guided path from fundamentals to checkout and deployment.', courseIds: json(courses.slice(0, 4).map((course) => course.id)), active: true },
    create: { title: 'Demo SaaS Launch Path', slug: 'demo-saas-launch-path', description: 'A guided path from fundamentals to checkout and deployment.', courseIds: json(courses.slice(0, 4).map((course) => course.id)), active: true },
  });
  await prisma.learningPathEnrollment.upsert({
    where: { learningPathId_userId: { learningPathId: path.id, userId: student.id } },
    update: { progress: 64 },
    create: { learningPathId: path.id, userId: student.id, progress: 64 },
  });
  if (firstLesson) {
    await prisma.dripSchedule.deleteMany({ where: { lessonId: firstLesson.id } });
    await prisma.dripSchedule.create({ data: { courseId: primaryCourse.id, lessonId: firstLesson.id, unlockDay: 3 } });
    await prisma.lessonBookmark.upsert({
      where: { userId_lessonId: { userId: student.id, lessonId: firstLesson.id } },
      update: { note: 'Demo bookmark for reviewer QA.' },
      create: { userId: student.id, lessonId: firstLesson.id, note: 'Demo bookmark for reviewer QA.' },
    });
    await prisma.videoAsset.upsert({
      where: { lessonId: firstLesson.id },
      update: { provider: 'demo', externalId: 'demo-video-asset', embedUrl: 'https://example.com/embed/demo-video', hlsUrl: 'https://example.com/hls/demo.m3u8', duration: 480, status: 'READY' },
      create: { lessonId: firstLesson.id, provider: 'demo', externalId: 'demo-video-asset', embedUrl: 'https://example.com/embed/demo-video', hlsUrl: 'https://example.com/hls/demo.m3u8', duration: 480, status: 'READY' },
    });
  }
  await prisma.licenseActivation.upsert({
    where: { purchaseCode: 'DEMO-LICENSE-0001' },
    update: { domain: 'demo.learnova.test', email: 'admin@demo.com', active: true },
    create: { purchaseCode: 'DEMO-LICENSE-0001', domain: 'demo.learnova.test', email: 'admin@demo.com', active: true },
  });
  await prisma.loginHistory.deleteMany({ where: { email: { in: ['admin@demo.com', 'student@demo.com'] } } });
  await prisma.loginHistory.createMany({
    data: [
      { userId: admin.id, email: 'admin@demo.com', ip: '127.0.0.1', userAgent: 'Demo browser', success: true },
      { userId: student.id, email: 'student@demo.com', ip: '127.0.0.1', userAgent: 'Demo browser', success: true },
    ],
  });
  await prisma.ltiTool.deleteMany({ where: { clientId: 'demo-lti-client' } });
  await prisma.ltiTool.create({ data: { name: 'Demo LTI Classroom', clientId: 'demo-lti-client', launchUrl: 'https://example.com/lti/launch', publicKey: 'demo-public-key', active: true } });
  const previousMentorPrograms = await prisma.mentorProgram.findMany({
    where: { title: 'Demo SaaS Mentorship' },
    select: { id: true },
  });
  if (previousMentorPrograms.length) {
    await prisma.mentorEnrollment.deleteMany({
      where: { programId: { in: previousMentorPrograms.map((program) => program.id) } },
    });
    await prisma.mentorProgram.deleteMany({ where: { id: { in: previousMentorPrograms.map((program) => program.id) } } });
  }
  const mentorProgram = await prisma.mentorProgram.create({ data: { title: 'Demo SaaS Mentorship', description: 'One-on-one mentorship for the demo SaaS builder path.', instructorId: instructor.id, price: 149, active: true } });
  await prisma.mentorEnrollment.upsert({
    where: { programId_userId: { programId: mentorProgram.id, userId: student.id } },
    update: { status: 'ACTIVE' },
    create: { programId: mentorProgram.id, userId: student.id, status: 'ACTIVE' },
  });
  await prisma.npsResponse.deleteMany({ where: { userId: student.id } });
  await prisma.npsResponse.create({ data: { userId: student.id, score: 9, comment: 'Demo NPS response for admin analytics.' } });
  await prisma.pageView.deleteMany({ where: { referrer: 'demo-seed' } });
  await prisma.pageView.createMany({
    data: [
      { path: '/courses', userId: student.id, referrer: 'demo-seed' },
      { path: '/checkout', userId: student.id, referrer: 'demo-seed' },
      { path: '/admin/theme', userId: admin.id, referrer: 'demo-seed' },
    ],
  });
  await prisma.portfolioProject.deleteMany({ where: { userId: student.id, title: { startsWith: 'Demo ' } } });
  await prisma.portfolioProject.create({ data: { userId: student.id, title: 'Demo SaaS Dashboard', description: 'Portfolio project generated from the SaaS masterclass.', url: 'https://example.com/portfolio/demo-saas', imageUrl: '/images/course-covers/nextjs-saas-masterclass.png', public: true } });
  await prisma.resumeProfile.upsert({
    where: { userId: student.id },
    update: { headline: 'Demo SaaS Builder', summary: 'Learner profile for marketplace reviewer testing.', links: json(['https://example.com/portfolio/demo-saas']) },
    create: { userId: student.id, headline: 'Demo SaaS Builder', summary: 'Learner profile for marketplace reviewer testing.', links: json(['https://example.com/portfolio/demo-saas']) },
  });
  await prisma.procurementRequest.deleteMany({ where: { title: 'Demo team training request' } });
  await prisma.procurementRequest.create({ data: { organizationId: org.id, requesterId: admin.id, title: 'Demo team training request', budget: 2400, status: 'APPROVED' } });
  await prisma.purchaseOrder.upsert({
    where: { poNumber: 'DEMO-PO-001' },
    update: { organizationId: org.id, orderId: firstOrder?.id, amount: 2400, status: 'OPEN' },
    create: { organizationId: org.id, orderId: firstOrder?.id, poNumber: 'DEMO-PO-001', amount: 2400, status: 'OPEN' },
  });
  if (firstQuiz) {
    await prisma.quizAttempt.deleteMany({ where: { quizId: firstQuiz.id, userId: student.id } });
    await prisma.quizAttempt.create({ data: { quizId: firstQuiz.id, userId: student.id, score: 87, passed: true } });
  }
  await prisma.rateLimitRule.upsert({
    where: { key: 'demo.assistant.chat' },
    update: { limit: 30, windowSec: 60, active: true },
    create: { key: 'demo.assistant.chat', limit: 30, windowSec: 60, active: true },
  });
  await prisma.recommendationRule.deleteMany({ where: { title: 'Demo SaaS recommendations' } });
  await prisma.recommendationRule.create({ data: { title: 'Demo SaaS recommendations', courseIds: json(courses.slice(0, 3).map((course) => course.id)), audience: 'STUDENTS', active: true } });
  if (firstOrder) {
    await prisma.refundRequest.deleteMany({ where: { userId: student.id, orderId: firstOrder.id } });
    await prisma.refundRequest.create({ data: { userId: student.id, orderId: firstOrder.id, reason: 'Demo refund request for admin workflow.', status: 'PENDING' } });
  }
  await prisma.savedSearch.deleteMany({ where: { userId: student.id, query: { startsWith: 'demo ' } } });
  await prisma.savedSearch.create({ data: { userId: student.id, query: 'demo saas', filters: json({ level: 'intermediate', certificate: true }) } });
  await prisma.scormAttempt.deleteMany({ where: { userId: student.id, score: 92, status: 'COMPLETED' } });
  await prisma.scormPackage.deleteMany({ where: { title: 'Demo SCORM package' } });
  const scorm = await prisma.scormPackage.create({ data: { courseId: primaryCourse.id, title: 'Demo SCORM package', manifestUrl: '/scorm/demo/imsmanifest.xml', launchUrl: '/scorm/demo/index.html', active: true } });
  await prisma.scormAttempt.create({ data: { packageId: scorm.id, userId: student.id, score: 92, status: 'COMPLETED', runtimeData: json({ lesson_status: 'completed' }) } });
  await prisma.skillProfile.upsert({
    where: { userId_skill: { userId: student.id, skill: 'SaaS product delivery' } },
    update: { level: 'intermediate', source: 'demo-course' },
    create: { userId: student.id, skill: 'SaaS product delivery', level: 'intermediate', source: 'demo-course' },
  });
  await prisma.slaPolicy.deleteMany({ where: { name: { startsWith: 'Demo ' } } });
  await prisma.slaPolicy.createMany({
    data: [
      { name: 'Demo standard support', responseHrs: 24, resolveHrs: 72, active: true },
      { name: 'Demo priority support', responseHrs: 4, resolveHrs: 24, active: true },
    ],
  });
  await prisma.sponsorship.deleteMany({ where: { sponsor: { startsWith: 'Demo ' } } });
  await prisma.sponsorship.create({ data: { sponsor: 'Demo Learning Sponsor', placement: 'homepage', imageUrl: '/icon.svg', targetUrl: '/partners', active: true, startsAt: new Date(), endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
  await prisma.donation.deleteMany({
    where: {
      campaignId: {
        in: (await prisma.donationCampaign.findMany({ where: { title: 'Demo Learner Access Fund' }, select: { id: true } })).map((campaign) => campaign.id),
      },
    },
  });
  await prisma.donationCampaign.deleteMany({ where: { title: 'Demo Learner Access Fund' } });
  const donationCampaign = await prisma.donationCampaign.create({
    data: { title: 'Demo Learner Access Fund', description: 'Sample donation campaign for learner scholarships and access programs.', goal: 10000, active: true },
  });
  await prisma.donation.createMany({
    data: [
      { campaignId: donationCampaign.id, donorName: 'Demo Sponsor', amount: 500, message: 'Supporting practical learning access.' },
      { campaignId: donationCampaign.id, donorName: 'Northstar Alumni', amount: 250, message: 'Keep the demo learner fund moving.' },
    ],
  });
  const plan = await prisma.subscriptionPlan.findFirst({ where: { active: true } });
  if (plan) {
    await prisma.subscription.deleteMany({ where: { userId: student.id, planId: plan.id } });
    await prisma.subscription.create({ data: { userId: student.id, planId: plan.id, status: 'ACTIVE', endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
  }
  await prisma.systemMetricSnapshot.deleteMany({ where: { key: { startsWith: 'demo.' } } });
  await prisma.systemMetricSnapshot.createMany({
    data: [
      { key: 'demo.active_learners', value: 128 },
      { key: 'demo.checkout_conversion', value: 12.4 },
      { key: 'demo.course_completion', value: 68 },
    ],
  });
  await prisma.translationJob.deleteMany({ where: { entity: 'demo' } });
  await prisma.translationJob.create({ data: { entity: 'demo', entityId: primaryCourse.id, locale: 'ar', status: 'DONE', result: json({ title: 'دورة تجريبية' }) } });
  await prisma.userDevice.deleteMany({ where: { userId: student.id, name: { startsWith: 'Demo ' } } });
  await prisma.userDevice.create({ data: { userId: student.id, name: 'Demo Chrome Device', token: 'demo-device-token' } });
  await prisma.userProfileField.deleteMany({ where: { userId: student.id, key: { startsWith: 'demo_' } } });
  await prisma.userProfileField.createMany({
    data: [
      { userId: student.id, key: 'demo_goal', value: 'Launch a SaaS portfolio project' },
      { userId: student.id, key: 'demo_level', value: 'Intermediate' },
    ],
  });
  await prisma.withdrawal.deleteMany({ where: { instructorId: instructor.id } });
  await prisma.withdrawal.create({ data: { instructorId: instructor.id, amount: 120, method: 'Bank transfer', status: 'APPROVED' } });
  await prisma.oAuthAccount.upsert({
    where: { provider_providerAccountId: { provider: 'demo-oauth', providerAccountId: 'demo-student-oauth' } },
    update: { userId: student.id, accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    create: { userId: student.id, provider: 'demo-oauth', providerAccountId: 'demo-student-oauth', accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });
  await prisma.twoFactorAuth.upsert({
    where: { userId: admin.id },
    update: { secret: 'DEMO-2FA-SECRET', backupCodes: json(['DEMO-CODE-1', 'DEMO-CODE-2']), enabled: false },
    create: { userId: admin.id, secret: 'DEMO-2FA-SECRET', backupCodes: json(['DEMO-CODE-1', 'DEMO-CODE-2']), enabled: false },
  });
  if (firstAssignment) {
    await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: firstAssignment.id, userId: student.id } });
    await prisma.assignmentSubmission.create({ data: { assignmentId: firstAssignment.id, userId: student.id, content: 'Demo submission with launch checklist and project notes.', fileUrl: '/uploads/demo-assignment.pdf', grade: 92, feedback: 'Strong demo submission for reviewer QA.' } });
  }
  await prisma.aICourseIdea.deleteMany({ where: { prompt: { startsWith: 'Demo ' } } });
  await prisma.aICourseIdea.create({ data: { userId: instructor.id, prompt: 'Demo generate a course about SaaS launch systems', outline: json({ modules: ['Positioning', 'Build', 'Checkout', 'Launch'] }) } });
  await prisma.contentRewriteRequest.deleteMany({ where: { input: { startsWith: 'Demo ' } } });
  await prisma.contentRewriteRequest.create({ data: { userId: admin.id, input: 'Demo rewrite this course description for marketplace clarity.', tone: 'professional', output: 'A clear, outcome-focused course description for reviewers.', status: 'DONE' } });

  const counts = {};
  for (const model of [
    'supportTicket', 'announcement', 'taxRate', 'message', 'survey', 'featureFlag', 'organization',
    'notification', 'notificationPreference', 'emailLog', 'releaseChecklist',
    'supportTag', 'productUpdate', 'seoRedirect', 'seoMetaOverride', 'careerTrack', 'jobBoardPost',
    'tenant', 'pushNotificationCampaign', 'partner', 'partnerOffer', 'grantProgram', 'scholarship',
    'vendor', 'vendorContract', 'courseFaq', 'courseAnnouncement', 'webhookEndpoint', 'webhookDelivery',
    'abuseReport', 'auditLog', 'adminNote', 'apiKey', 'apiUsageLog', 'automationRule', 'automationRun', 'backupLog',
    'badgeAward', 'booking', 'bulkEnrollmentInvite', 'calendarEvent', 'cart', 'cartItem', 'consentRecord',
    'contentModerationRule', 'courseCohort', 'cohortEnrollment', 'courseCollection', 'courseImportJob',
    'courseExportJob', 'courseLicense', 'courseMilestone', 'courseNote', 'courseOutcomeSkill',
    'coursePrerequisite', 'courseReport', 'courseResource', 'courseTranslation', 'dataRetentionPolicy',
    'discussionTopic', 'discussionReply', 'domainVerification', 'donationCampaign', 'donation',
    'dpaAgreement', 'dripSchedule', 'experiment',
    'instructorAvailability', 'instructorBadge', 'instructorPayoutMethod', 'instructorReview',
    'invoiceTemplate', 'jobQueue', 'learningGoal', 'learningPath', 'learningPathEnrollment',
    'lessonBookmark', 'licenseActivation', 'loginHistory', 'ltiTool', 'mentorProgram', 'mentorEnrollment',
    'oAuthAccount',
    'moderationQueueItem', 'npsResponse', 'pageView', 'portfolioProject', 'procurementRequest',
    'purchaseOrder', 'quizAttempt', 'rateLimitRule', 'recommendationRule', 'refundRequest', 'savedSearch',
    'scormPackage', 'scormAttempt', 'skillProfile', 'slaPolicy', 'sponsorship', 'subscription',
    'systemMetricSnapshot', 'translationJob', 'twoFactorAuth', 'userDevice', 'userProfileField', 'videoAsset',
    'webhookEvent', 'wishlistCollection', 'withdrawal', 'assignmentSubmission', 'aICourseIdea',
    'contentRewriteRequest',
  ]) {
    counts[model] = await prisma[model].count();
  }

  console.log('Supplemental showcase content seeded.');
  console.log(JSON.stringify({ conversationId: conversation.id, counts }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

