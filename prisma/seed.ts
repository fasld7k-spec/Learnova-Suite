import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { toJson, toList } from '../lib/json-fields';
import { languagePresets } from '../lib/localized-copy';
import { addonConfigFromManifest, defaultAddonCatalog } from '../lib/addons';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: { name: 'Demo Admin', email: 'admin@demo.com', passwordHash, role: 'ADMIN' }
  });

  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@demo.com' },
    update: {},
    create: {
      name: 'Sarah Instructor',
      email: 'instructor@demo.com',
      passwordHash,
      role: 'INSTRUCTOR',
      status: 'APPROVED',
      bio: 'Senior full-stack educator and product mentor'
    }
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@demo.com' },
    update: {},
    create: { name: 'Omar Student', email: 'student@demo.com', passwordHash, role: 'STUDENT' }
  });

  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@demo.com' },
    update: {},
    create: { name: 'Aisha Buyer', email: 'buyer@demo.com', passwordHash, role: 'STUDENT' }
  });

  const web = await prisma.category.upsert({
    where: { slug: 'web-development' },
    update: {},
    create: { nameEn: 'Web Development', nameAr: 'تطوير الويب', slug: 'web-development' }
  });

  const design = await prisma.category.upsert({
    where: { slug: 'design' },
    update: {},
    create: { nameEn: 'Design', nameAr: 'التصميم', slug: 'design' }
  });

  const [dataAi, business, marketing, careerSkills] = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'data-ai' },
      update: {},
      create: { nameEn: 'Data & AI', nameAr: 'Data and AI', slug: 'data-ai' }
    }),
    prisma.category.upsert({
      where: { slug: 'business' },
      update: {},
      create: { nameEn: 'Business', nameAr: 'Business', slug: 'business' }
    }),
    prisma.category.upsert({
      where: { slug: 'marketing' },
      update: {},
      create: { nameEn: 'Marketing', nameAr: 'Marketing', slug: 'marketing' }
    }),
    prisma.category.upsert({
      where: { slug: 'career-skills' },
      update: {},
      create: { nameEn: 'Career Skills', nameAr: 'Career Skills', slug: 'career-skills' }
    })
  ]);

  const course = await prisma.course.upsert({
    where: { slug: 'nextjs-saas-masterclass' },
    update: { coverImage: '/images/course-covers/nextjs-saas-masterclass.png', promoVideo: null, targetAudience: toList(['React developers', 'SaaS founders', 'Full-stack learners']), includesCertificate: true },
    create: {
      title: 'Next.js SaaS Masterclass',
      slug: 'nextjs-saas-masterclass',
      shortDescription: 'Build production-ready SaaS apps using Next.js.',
      fullDescription: 'A practical course for building SaaS applications, dashboards, payments, SEO and deployment.',
      coverImage: '/images/course-covers/nextjs-saas-masterclass.png',
      promoVideo: null,
      price: 99,
      salePrice: 49,
      language: 'en',
      level: 'intermediate',
      durationMinutes: 480,
      requirements: toList(['Basic JavaScript', 'React fundamentals']),
      outcomes: toList(['Build dashboards', 'Create secure APIs', 'Integrate payments', 'Ship production apps']),
      targetAudience: toList(['React developers', 'SaaS founders', 'Full-stack learners']),
      includesCertificate: true,
      status: 'PUBLISHED',
      instructorId: instructor.id,
      categoryId: web.id,
      modules: {
        create: [
          {
            title: 'Getting Started',
            sortOrder: 1,
            lessons: {
              create: [
                { title: 'Course Overview', type: 'VIDEO', videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', durationMinutes: 8, isPreview: true },
                { title: 'Project Setup', type: 'TEXT', content: 'Install Node.js and configure environment.', durationMinutes: 15 }
              ]
            }
          },
          {
            title: 'Marketplace Core',
            sortOrder: 2,
            lessons: {
              create: [
                { title: 'Course APIs', type: 'VIDEO', durationMinutes: 25 },
                { title: 'Checkout Flow', type: 'VIDEO', durationMinutes: 30 }
              ]
            }
          }
        ]
      }
    }
  });

  const designCourse = await prisma.course.upsert({
    where: { slug: 'ui-ux-design-fundamentals' },
    update: { coverImage: '/images/course-covers/ui-ux-design-fundamentals.png', promoVideo: null, targetAudience: toList(['New product designers', 'Developers improving UI skills', 'Founders validating product workflows']), includesCertificate: true },
    create: {
      title: 'UI/UX Design Fundamentals',
      slug: 'ui-ux-design-fundamentals',
      shortDescription: 'Learn modern product design and UX workflows.',
      fullDescription: 'Master user research, wireframes, design systems and usability.',
      coverImage: '/images/course-covers/ui-ux-design-fundamentals.png',
      promoVideo: null,
      price: 79,
      salePrice: 29,
      language: 'en',
      level: 'beginner',
      durationMinutes: 360,
      requirements: toList(['No prior design experience']),
      outcomes: toList(['Create wireframes', 'Build design systems', 'Run usability reviews']),
      targetAudience: toList(['New product designers', 'Developers improving UI skills', 'Founders validating product workflows']),
      includesCertificate: true,
      status: 'PUBLISHED',
      instructorId: instructor.id,
      categoryId: design.id,
      modules: {
        create: [
          {
            title: 'UX Foundations',
            sortOrder: 1,
            lessons: {
              create: [
                { title: 'User Research', type: 'TEXT', content: 'Research methods and personas.', durationMinutes: 20 },
                { title: 'Wireframing', type: 'VIDEO', durationMinutes: 25 }
              ]
            }
          }
        ]
      }
    }
  });

  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    update: { progress: 100, completedAt: new Date() },
    create: { userId: student.id, courseId: course.id, progress: 100, completedAt: new Date() }
  });

  const extraStudents = await Promise.all([
    prisma.user.upsert({
      where: { email: 'maya.student@example.com' },
      update: {},
      create: { name: 'Maya Hassan', email: 'maya.student@example.com', passwordHash, role: 'STUDENT', avatar: 'https://i.pravatar.cc/160?img=47' }
    }),
    prisma.user.upsert({
      where: { email: 'karim.student@example.com' },
      update: {},
      create: { name: 'Karim Ali', email: 'karim.student@example.com', passwordHash, role: 'STUDENT', avatar: 'https://i.pravatar.cc/160?img=12' }
    }),
    prisma.user.upsert({
      where: { email: 'lina.student@example.com' },
      update: {},
      create: { name: 'Lina Morgan', email: 'lina.student@example.com', passwordHash, role: 'STUDENT', avatar: 'https://i.pravatar.cc/160?img=32' }
    }),
    prisma.user.upsert({
      where: { email: 'nour.student@example.com' },
      update: {},
      create: { name: 'Nour Adel', email: 'nour.student@example.com', passwordHash, role: 'STUDENT', avatar: 'https://i.pravatar.cc/160?img=5' }
    })
  ]);

  const extraCourseSpecs = [
    {
      title: 'React Native Mobile Apps',
      slug: 'react-native-mobile-apps',
      shortDescription: 'Ship polished iOS and Android apps with a single React codebase.',
      fullDescription: 'Build production mobile screens, navigation, auth, offline-ready data, push notifications, and store release checklists.',
      coverImage: '/images/course-covers/react-native-mobile-apps.svg',
      price: 119,
      salePrice: 59,
      language: 'en',
      level: 'intermediate',
      durationMinutes: 540,
      categoryId: web.id,
      requirements: ['React fundamentals', 'Basic JavaScript'],
      outcomes: ['Create native navigation flows', 'Connect mobile APIs', 'Prepare app store releases'],
      targetAudience: ['Frontend developers', 'Startup builders', 'Mobile beginners'],
      modules: [
        { title: 'Mobile Foundations', lessons: ['Expo project setup', 'Navigation and layouts', 'Reusable mobile components'] },
        { title: 'Production Mobile', lessons: ['Authentication flow', 'Offline data patterns', 'Release checklist'] }
      ]
    },
    {
      title: 'Data Analysis with Python',
      slug: 'data-analysis-with-python',
      shortDescription: 'Turn raw datasets into decisions with Python, Pandas, and clear dashboards.',
      fullDescription: 'A hands-on path through notebooks, cleaning, exploration, charts, business metrics, and reporting workflows.',
      coverImage: '/images/course-covers/data-analysis-python.svg',
      price: 89,
      salePrice: 39,
      language: 'en',
      level: 'beginner',
      durationMinutes: 420,
      categoryId: dataAi.id,
      requirements: ['Basic computer skills', 'No prior Python required'],
      outcomes: ['Clean datasets', 'Create charts', 'Explain insights to stakeholders'],
      targetAudience: ['Analysts', 'Operations teams', 'Career switchers'],
      modules: [
        { title: 'Python for Analysis', lessons: ['Notebook setup', 'Pandas essentials', 'Data cleaning workflow'] },
        { title: 'Business Reporting', lessons: ['Exploratory charts', 'KPI dashboard structure', 'Insight presentation'] }
      ]
    },
    {
      title: 'AI Tools for Business Teams',
      slug: 'ai-tools-for-business-teams',
      shortDescription: 'Use modern AI workflows for research, operations, marketing, and support.',
      fullDescription: 'Design safe AI workflows, reusable prompt systems, team policies, and automation ideas for business departments.',
      coverImage: '/images/course-covers/ai-tools-business.svg',
      price: 69,
      salePrice: 24,
      language: 'en',
      level: 'beginner',
      durationMinutes: 300,
      categoryId: business.id,
      requirements: ['Comfort using web apps'],
      outcomes: ['Build prompt playbooks', 'Review AI output safely', 'Automate repetitive business tasks'],
      targetAudience: ['Managers', 'Founders', 'Operations teams'],
      modules: [
        { title: 'AI Workflow Design', lessons: ['Use cases and risks', 'Prompt templates', 'Review and approval loops'] },
        { title: 'Team Rollout', lessons: ['Internal policy', 'Marketing workflow', 'Support workflow'] }
      ]
    },
    {
      title: 'Digital Marketing Growth Lab',
      slug: 'digital-marketing-growth-lab',
      shortDescription: 'Plan campaigns, funnels, landing pages, and analytics for measurable growth.',
      fullDescription: 'Learn acquisition channels, paid ads structure, email funnels, SEO content planning, and weekly reporting.',
      coverImage: '/images/course-covers/digital-marketing-growth.svg',
      price: 79,
      salePrice: 34,
      language: 'en',
      level: 'intermediate',
      durationMinutes: 390,
      categoryId: marketing.id,
      requirements: ['Basic marketing vocabulary'],
      outcomes: ['Design campaigns', 'Measure funnel metrics', 'Write conversion-focused landing pages'],
      targetAudience: ['Marketers', 'Creators', 'Small business owners'],
      modules: [
        { title: 'Growth Strategy', lessons: ['Audience and offer', 'Channel selection', 'Campaign calendar'] },
        { title: 'Measurement', lessons: ['Tracking basics', 'Landing page experiments', 'Weekly growth report'] }
      ]
    },
    {
      title: 'Product Management Practical',
      slug: 'product-management-practical',
      shortDescription: 'Move from idea to roadmap using discovery, prioritization, and delivery rituals.',
      fullDescription: 'A practical PM program covering customer interviews, product strategy, roadmaps, sprint planning, and stakeholder updates.',
      coverImage: '/images/course-covers/product-management-practical.svg',
      price: 109,
      salePrice: 54,
      language: 'en',
      level: 'intermediate',
      durationMinutes: 460,
      categoryId: business.id,
      requirements: ['Experience working with digital products'],
      outcomes: ['Run discovery interviews', 'Prioritize roadmaps', 'Communicate product decisions'],
      targetAudience: ['Aspiring PMs', 'Founders', 'Team leads'],
      modules: [
        { title: 'Discovery', lessons: ['Problem framing', 'Interview scripts', 'Opportunity sizing'] },
        { title: 'Delivery', lessons: ['Roadmap planning', 'Sprint rituals', 'Stakeholder updates'] }
      ]
    },
    {
      title: 'Career Accelerator for Freelancers',
      slug: 'career-accelerator-for-freelancers',
      shortDescription: 'Build a service offer, portfolio, pricing model, and client pipeline.',
      fullDescription: 'Create a clear freelance positioning system with proposals, discovery calls, pricing, delivery templates, and retention workflows.',
      coverImage: '/images/course-covers/freelancer-career-accelerator.svg',
      price: 59,
      salePrice: 19,
      language: 'en',
      level: 'beginner',
      durationMinutes: 260,
      categoryId: careerSkills.id,
      requirements: ['A skill you want to sell'],
      outcomes: ['Package your offer', 'Price projects', 'Improve proposal conversion'],
      targetAudience: ['Freelancers', 'Students', 'Career changers'],
      modules: [
        { title: 'Offer Design', lessons: ['Positioning basics', 'Portfolio proof', 'Pricing models'] },
        { title: 'Client Pipeline', lessons: ['Discovery calls', 'Proposal structure', 'Retention system'] }
      ]
    }
  ];

  const extraCourses: typeof course[] = [];
  for (const spec of extraCourseSpecs) {
    const extraCourse = await prisma.course.upsert({
      where: { slug: spec.slug },
      update: {
        title: spec.title,
        shortDescription: spec.shortDescription,
        fullDescription: spec.fullDescription,
        coverImage: spec.coverImage,
        price: spec.price,
        salePrice: spec.salePrice,
        language: spec.language,
        level: spec.level,
        durationMinutes: spec.durationMinutes,
        requirements: toList(spec.requirements),
        outcomes: toList(spec.outcomes),
        targetAudience: toList(spec.targetAudience),
        includesCertificate: true,
        status: 'PUBLISHED',
        categoryId: spec.categoryId
      },
      create: {
        title: spec.title,
        slug: spec.slug,
        shortDescription: spec.shortDescription,
        fullDescription: spec.fullDescription,
        coverImage: spec.coverImage,
        price: spec.price,
        salePrice: spec.salePrice,
        language: spec.language,
        level: spec.level,
        durationMinutes: spec.durationMinutes,
        requirements: toList(spec.requirements),
        outcomes: toList(spec.outcomes),
        targetAudience: toList(spec.targetAudience),
        includesCertificate: true,
        status: 'PUBLISHED',
        instructorId: instructor.id,
        categoryId: spec.categoryId,
        modules: {
          create: spec.modules.map((module, moduleIndex) => ({
            title: module.title,
            sortOrder: moduleIndex + 1,
            lessons: {
              create: module.lessons.map((lessonTitle, lessonIndex) => ({
                title: lessonTitle,
                type: lessonIndex === 0 ? 'VIDEO' : lessonIndex === 1 ? 'TEXT' : 'FILE',
                videoUrl: lessonIndex === 0 ? 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' : null,
                content: lessonIndex === 1 ? `${lessonTitle} practical notes and checklist.` : null,
                attachmentUrl: lessonIndex === 2 ? '/sample-lesson-resource.pdf' : null,
                durationMinutes: 18 + lessonIndex * 7,
                isPreview: moduleIndex === 0 && lessonIndex === 0,
                sortOrder: lessonIndex + 1
              }))
            }
          }))
        }
      }
    });
    extraCourses.push(extraCourse);
  }

  const allDemoCourses = [course, designCourse, ...extraCourses];

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: buyer.id, courseId: course.id } },
    update: { progress: 45 },
    create: { userId: buyer.id, courseId: course.id, progress: 45 }
  });

  await prisma.favorite.upsert({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    update: {},
    create: { userId: student.id, courseId: course.id }
  });

  await prisma.favorite.upsert({
    where: { userId_courseId: { userId: student.id, courseId: designCourse.id } },
    update: {},
    create: { userId: student.id, courseId: designCourse.id }
  });

  await prisma.courseWaitlist.upsert({
    where: { courseId_email: { courseId: course.id, email: 'prospect@example.com' } },
    update: {},
    create: { courseId: course.id, email: 'prospect@example.com' }
  });

  await prisma.courseWaitlist.upsert({
    where: { courseId_email: { courseId: designCourse.id, email: 'design.buyer@example.com' } },
    update: {},
    create: { courseId: designCourse.id, email: 'design.buyer@example.com' }
  });

  await prisma.courseView.deleteMany({ where: { courseId: { in: allDemoCourses.map((demoCourse) => demoCourse.id) } } });
  await prisma.courseView.createMany({
    data: Array.from({ length: 140 }, (_, index) => {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - (index % 21));
      const viewedCourse = allDemoCourses[index % allDemoCourses.length];
      const viewer = [buyer, student, ...extraStudents][index % (extraStudents.length + 2)];
      return {
        courseId: viewedCourse.id,
        userId: index % 3 === 0 ? viewer.id : null,
        ip: `203.0.113.${10 + (index % 80)}`,
        createdAt
      };
    })
  });

  const seededLessons = await prisma.lesson.findMany({
    where: { module: { courseId: course.id } },
    include: { module: true },
    orderBy: [{ module: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { title: 'asc' }]
  });

  for (const lesson of seededLessons) {
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: student.id, lessonId: lesson.id } },
      update: { completed: true },
      create: { userId: student.id, lessonId: lesson.id, completed: true }
    });
  }

  async function seedEnrollmentProgress(userId: string, targetCourse: typeof course, progress: number) {
    const completedAt = progress >= 100 ? new Date() : null;
    const seededEnrollment = await prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId: targetCourse.id } },
      update: { progress, completedAt },
      create: { userId, courseId: targetCourse.id, progress, completedAt }
    });

    const lessons = await prisma.lesson.findMany({
      where: { module: { courseId: targetCourse.id } },
      orderBy: [{ module: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { title: 'asc' }]
    });
    const completedCount = progress >= 100 ? lessons.length : Math.max(1, Math.floor((lessons.length * progress) / 100));

    for (const [lessonIndex, lesson] of lessons.entries()) {
      await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
        update: { completed: lessonIndex < completedCount },
        create: { userId, lessonId: lesson.id, completed: lessonIndex < completedCount }
      });
    }

    return seededEnrollment;
  }

  const completedShowcaseEnrollments = [
    await seedEnrollmentProgress(student.id, designCourse, 100),
    await seedEnrollmentProgress(extraStudents[0].id, course, 100),
    await seedEnrollmentProgress(extraStudents[1].id, extraCourses[0], 100),
    await seedEnrollmentProgress(extraStudents[2].id, extraCourses[1], 100)
  ];

  await seedEnrollmentProgress(student.id, extraCourses[0], 72);
  await seedEnrollmentProgress(student.id, extraCourses[1], 38);
  await seedEnrollmentProgress(buyer.id, designCourse, 64);
  await seedEnrollmentProgress(extraStudents[3].id, extraCourses[2], 24);
  await seedEnrollmentProgress(extraStudents[0].id, extraCourses[3], 55);
  await seedEnrollmentProgress(extraStudents[1].id, extraCourses[4], 18);
  await seedEnrollmentProgress(extraStudents[2].id, extraCourses[5], 81);

  for (const favoriteCourse of [extraCourses[0], extraCourses[2], extraCourses[4]]) {
    await prisma.favorite.upsert({
      where: { userId_courseId: { userId: student.id, courseId: favoriteCourse.id } },
      update: {},
      create: { userId: student.id, courseId: favoriteCourse.id }
    });
  }

  const completedCertificateTargets = [
    { enrollment: completedShowcaseEnrollments[0], user: student, targetCourse: designCourse, code: 'CERT-DEMO-UIUX-OMAR' },
    { enrollment: completedShowcaseEnrollments[1], user: extraStudents[0], targetCourse: course, code: 'CERT-DEMO-SAAS-MAYA' },
    { enrollment: completedShowcaseEnrollments[2], user: extraStudents[1], targetCourse: extraCourses[0], code: 'CERT-DEMO-MOBILE-KARIM' },
    { enrollment: completedShowcaseEnrollments[3], user: extraStudents[2], targetCourse: extraCourses[1], code: 'CERT-DEMO-DATA-LINA' }
  ];

  for (const certificateTarget of completedCertificateTargets) {
    await prisma.certificate.upsert({
      where: { enrollmentId: certificateTarget.enrollment.id },
      update: {
        courseTitle: certificateTarget.targetCourse.title,
        instructorName: instructor.name
      },
      create: {
        code: certificateTarget.code,
        userId: certificateTarget.user.id,
        enrollmentId: certificateTarget.enrollment.id,
        courseTitle: certificateTarget.targetCourse.title,
        instructorName: instructor.name
      }
    });
  }

  const setupLesson = seededLessons.find((lesson) => lesson.title === 'Project Setup') || seededLessons[0];
  if (setupLesson) {
    const setupQuizzes = await prisma.quiz.findMany({
      where: { lessonId: setupLesson.id, title: 'Project Setup Check' },
      select: { id: true }
    });
    const setupAssignments = await prisma.assignment.findMany({
      where: { lessonId: setupLesson.id, title: 'Create your environment checklist' },
      select: { id: true }
    });
    await prisma.quizAttempt.deleteMany({ where: { quizId: { in: setupQuizzes.map((quiz) => quiz.id) } } });
    await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: { in: setupAssignments.map((assignment) => assignment.id) } } });
    await prisma.quiz.deleteMany({ where: { lessonId: setupLesson.id, title: 'Project Setup Check' } });
    await prisma.assignment.deleteMany({ where: { lessonId: setupLesson.id, title: 'Create your environment checklist' } });

    await prisma.quiz.create({
      data: {
        lessonId: setupLesson.id,
        title: 'Project Setup Check',
        questions: toJson([
          { q: 'Which command installs project dependencies?', type: 'mcq', options: ['npm install', 'npm publish', 'git init'], answer: 'npm install' },
          { q: 'Next.js can render pages on the server.', type: 'true_false', answer: 'True' },
          { q: 'Write the environment variable file name used in local demos.', type: 'text', answer: '.env' },
          { q: 'Order the release flow.', type: 'ordering', answer: ['Build', 'Test', 'Deploy'] }
        ]),
        passingScore: 70
      }
    }).catch(() => null);

    await prisma.assignment.create({
      data: {
        courseId: course.id,
        lessonId: setupLesson.id,
        title: 'Create your environment checklist',
        description: 'Submit a short checklist showing Node.js, database, environment variables, and storage settings are ready.'
      }
    }).catch(() => null);
  }

  const paidOrder = await prisma.order.create({
    data: {
      userId: student.id,
      total: 49,
      currency: 'USD',
      status: 'PAID',
      gateway: 'stripe',
      invoiceNumber: `INV-DEMO-${Date.now()}`,
      items: {
        create: {
          courseId: course.id,
          title: course.title,
          price: 49,
          commission: 7.35,
          instructorEarning: 41.65
        }
      },
      payment: {
        create: {
          gateway: 'stripe',
          status: 'PAID',
          transactionId: 'demo-paid-order',
          metadata: toJson({ demo: true, note: 'Seeded paid order for buyer review.' })
        }
      }
    }
  }).catch(() => null);

  await prisma.order.create({
    data: {
      userId: buyer.id,
      total: 36.75,
      currency: 'USD',
      status: 'PAID',
      gateway: 'manual',
      invoiceNumber: `INV-DEMO-BUYER-${Date.now()}`,
      items: {
        create: {
          courseId: course.id,
          title: course.title,
          price: 36.75,
          commission: 5.51,
          instructorEarning: 31.24
        }
      },
      payment: {
        create: {
          gateway: 'manual',
          status: 'PAID',
          transactionId: 'demo-coupon-order',
          metadata: toJson({ demo: true, couponCode: 'WELCOME25', discount: 12.25 })
        }
      }
    }
  }).catch(() => null);

  await prisma.certificate.upsert({
    where: { enrollmentId: enrollment.id },
    update: {},
    create: {
      code: `CERT-DEMO-${student.id.slice(0, 5).toUpperCase()}`,
      userId: student.id,
      enrollmentId: enrollment.id,
      courseTitle: course.title,
      instructorName: instructor.name
    }
  });

  await prisma.liveSession.create({
    data: {
      title: 'Weekly Q&A: SaaS Architecture',
      description: 'Live class for enrolled students',
      startsAt: new Date(Date.now() + 86400000),
      durationMinutes: 60,
      provider: 'EXTERNAL',
      url: 'https://meet.google.com/demo',
      courseId: course.id,
      instructorId: instructor.id
    }
  }).catch(() => null);

  const welcomeCoupon = await prisma.coupon.upsert({
    where: { code: 'WELCOME25' },
    update: { discountType: 'PERCENT', percent: 25, amount: 0, active: true, startsAt: null, expiresAt: null, maxUses: 500, perUserLimit: 2, minOrderAmount: 0, courseIds: null },
    create: { code: 'WELCOME25', discountType: 'PERCENT', percent: 25, amount: 0, active: true, maxUses: 500, perUserLimit: 2 }
  });
  await prisma.coupon.upsert({
    where: { code: 'LAUNCH40' },
    update: { discountType: 'PERCENT', percent: 40, amount: 0, active: true, startsAt: null, expiresAt: new Date(Date.now() + 14 * 86400000), maxUses: 100, perUserLimit: 1, minOrderAmount: 20, courseIds: null },
    create: { code: 'LAUNCH40', discountType: 'PERCENT', percent: 40, amount: 0, active: true, expiresAt: new Date(Date.now() + 14 * 86400000), maxUses: 100, perUserLimit: 1, minOrderAmount: 20 }
  });
  await prisma.coupon.upsert({
    where: { code: 'FIXED10' },
    update: { discountType: 'FIXED', percent: 0, amount: 10, active: true, startsAt: null, expiresAt: null, maxUses: 200, perUserLimit: 3, minOrderAmount: 25, courseIds: toJson([course.id]) },
    create: { code: 'FIXED10', discountType: 'FIXED', percent: 0, amount: 10, active: true, maxUses: 200, perUserLimit: 3, minOrderAmount: 25, courseIds: toJson([course.id]) }
  });
  await prisma.coupon.upsert({
    where: { code: 'PAUSED10' },
    update: { discountType: 'PERCENT', percent: 10, amount: 0, active: false, startsAt: null, expiresAt: null, maxUses: null, perUserLimit: null, minOrderAmount: 0, courseIds: null },
    create: { code: 'PAUSED10', discountType: 'PERCENT', percent: 10, amount: 0, active: false }
  });
  if (paidOrder) {
    const existingRedemption = await prisma.couponRedemption.findFirst({
      where: { couponId: welcomeCoupon.id, userId: student.id, orderId: paidOrder.id }
    });
    if (!existingRedemption) {
      await prisma.couponRedemption.create({ data: { couponId: welcomeCoupon.id, userId: student.id, orderId: paidOrder.id } });
    }
  }

  await prisma.affiliateLink.deleteMany({
    where: { code: { in: [`AFF-${student.id.slice(0, 6).toUpperCase()}-SOCIAL`, `AFF-${student.id.slice(0, 6).toUpperCase()}-NEWSLETTER`] } }
  });
  await prisma.affiliateLink.createMany({
    data: [
      { userId: student.id, code: `AFF-${student.id.slice(0, 6).toUpperCase()}-SOCIAL`, clicks: 184, sales: 9 },
      { userId: student.id, code: `AFF-${student.id.slice(0, 6).toUpperCase()}-NEWSLETTER`, clicks: 73, sales: 3 }
    ]
  });
  if (paidOrder) {
    await prisma.affiliateCommission.deleteMany({ where: { affiliateUserId: student.id, orderId: paidOrder.id } });
    await prisma.affiliateCommission.createMany({
      data: [
        { affiliateUserId: student.id, orderId: paidOrder.id, amount: 14.7, status: 'APPROVED' },
        { affiliateUserId: student.id, orderId: paidOrder.id, amount: 6.25, status: 'PENDING' }
      ]
    });
  }

  await prisma.review.upsert({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    update: {},
    create: { userId: student.id, courseId: course.id, rating: 5, comment: 'Excellent practical SaaS course.' }
  });

  await prisma.review.upsert({
    where: { userId_courseId: { userId: buyer.id, courseId: course.id } },
    update: {},
    create: { userId: buyer.id, courseId: course.id, rating: 4, comment: 'The checkout and dashboard sections made the course feel production-ready.' }
  });

  const showcaseReviews = [
    { userId: extraStudents[0].id, courseId: course.id, rating: 5, comment: 'I finished the full course and the final dashboard project gave me a portfolio piece immediately.' },
    { userId: student.id, courseId: designCourse.id, rating: 5, comment: 'Clean UX lessons, practical checklists, and strong examples for improving course pages.' },
    { userId: extraStudents[1].id, courseId: extraCourses[0].id, rating: 5, comment: 'The mobile release checklist is exactly what I needed before publishing my first app.' },
    { userId: extraStudents[2].id, courseId: extraCourses[1].id, rating: 4, comment: 'Great pacing for beginners. The Pandas exercises make the dashboards feel real.' },
    { userId: buyer.id, courseId: extraCourses[2].id, rating: 5, comment: 'Useful for operations teams. The AI policy and approval workflow sections are very practical.' },
    { userId: extraStudents[3].id, courseId: extraCourses[3].id, rating: 4, comment: 'The funnel examples helped me understand where our campaign budget was leaking.' },
    { userId: extraStudents[0].id, courseId: extraCourses[4].id, rating: 5, comment: 'A compact and actionable PM course. The prioritization model is easy to reuse with teams.' },
    { userId: extraStudents[2].id, courseId: extraCourses[5].id, rating: 5, comment: 'The offer packaging exercise made my freelance profile much clearer.' }
  ];

  for (const review of showcaseReviews) {
    await prisma.review.upsert({
      where: { userId_courseId: { userId: review.userId, courseId: review.courseId } },
      update: { rating: review.rating, comment: review.comment },
      create: review
    });
  }

  const showcaseQuestionTitles = [
    'How long should the final project take?',
    'Can I use the mobile checklist for an existing app?',
    'Which dataset should I use for the dashboard assignment?',
    'Can my team reuse the AI workflow template?',
    'Is this marketing plan suitable for a small product launch?',
    'Can I show the PM roadmap exercise in my portfolio?'
  ];
  await prisma.question.deleteMany({ where: { title: { in: showcaseQuestionTitles } } });
  await prisma.question.createMany({
    data: [
      {
        userId: extraStudents[0].id,
        courseId: course.id,
        title: 'How long should the final project take?',
        body: 'I completed all lessons and want to estimate the capstone build time.',
        answer: 'Most students finish the capstone in 6 to 10 focused hours after completing the modules.'
      },
      {
        userId: extraStudents[1].id,
        courseId: extraCourses[0].id,
        title: 'Can I use the mobile checklist for an existing app?',
        body: 'My app is already built. I only need the release and QA checklist.',
        answer: 'Yes. Start from the Production Mobile module and adapt the release checklist to your current build.'
      },
      {
        userId: extraStudents[2].id,
        courseId: extraCourses[1].id,
        title: 'Which dataset should I use for the dashboard assignment?',
        body: 'Do you recommend sales, support, or marketing data for the final report?',
        answer: 'Sales data is easiest for the first attempt because revenue, volume, and conversion metrics are clear.'
      },
      {
        userId: buyer.id,
        courseId: extraCourses[2].id,
        title: 'Can my team reuse the AI workflow template?',
        body: 'We want to adapt the approval flow for support replies.',
        answer: 'Yes. The template is designed to be copied into team SOPs and adjusted per department.'
      },
      {
        userId: extraStudents[3].id,
        courseId: extraCourses[3].id,
        title: 'Is this marketing plan suitable for a small product launch?',
        body: 'We have a small budget and one landing page.',
        answer: 'Yes. Use the lean launch path: one audience, one offer, one channel, and weekly conversion review.'
      },
      {
        userId: student.id,
        courseId: extraCourses[4].id,
        title: 'Can I show the PM roadmap exercise in my portfolio?',
        body: 'I want to include the completed roadmap as a case study.',
        answer: 'Absolutely. Remove private data, explain your decisions, and show tradeoffs clearly.'
      }
    ]
  });

  await prisma.question.create({
    data: {
      userId: student.id,
      courseId: course.id,
      title: 'Do we deploy to Vercel?',
      body: 'Is Vercel suitable for production?',
      answer: 'Yes, Vercel with managed PostgreSQL is a great option.'
    }
  }).catch(() => null);

  await prisma.question.create({
    data: {
      userId: buyer.id,
      courseId: course.id,
      title: 'Can I use the coupon on cart checkout?',
      body: 'I want to buy more than one course and apply WELCOME25.',
      answer: 'Yes. The cart checkout applies active, unexpired coupons to the cart subtotal.'
    }
  }).catch(() => null);

  await prisma.blogPost.upsert({
    where: { slug: 'how-to-launch-online-academy' },
    update: {},
    create: {
      slug: 'how-to-launch-online-academy',
      title: 'How to Launch an Online Academy',
      excerpt: 'A practical checklist for launching your education business.',
      content: 'Choose a niche, prepare content, onboard instructors, configure payments and launch with SEO.',
      published: true
    }
  });

  const knowledgeBaseArticles = [
    {
      slug: 'prepare-your-first-course',
      title: 'Prepare your first course',
      category: 'Courses',
      body: 'Start by creating a clear course title, short description, outcomes, target audience, and at least one module with lessons. Keep preview lessons enabled when you want learners to inspect the course before checkout.'
    },
    {
      slug: 'test-checkout-before-launch',
      title: 'Test checkout before launch',
      category: 'Payments',
      body: 'Use the demo checkout flow to confirm cart totals, coupons, invoices, and payment status screens. Before accepting live payments, disable sandbox mode, configure provider credentials, add webhook secrets, and complete one provider sandbox QA cycle.'
    },
    {
      slug: 'manage-live-class-access',
      title: 'Manage live class access',
      category: 'Live Classes',
      body: 'Instructors can schedule live sessions with meeting URLs, duration, visibility, and course context. Students see enrolled, preview, and public sessions from their live sessions page.'
    },
    {
      slug: 'verify-student-certificates',
      title: 'Verify student certificates',
      category: 'Certificates',
      body: 'Each issued certificate has a verification code and public verification page. Admins can customize certificate templates and learners can share certificate links after completing eligible courses.'
    }
  ];

  for (const article of knowledgeBaseArticles) {
    await prisma.knowledgeBaseArticle.upsert({
      where: { slug: article.slug },
      update: { ...article, published: true },
      create: { ...article, published: true }
    });
  }

  await prisma.page.upsert({
    where: { slug: 'about' },
    update: {},
    create: {
      slug: 'about',
      titleEn: 'About Learnova Suite',
      titleAr: 'عن المنصة',
      bodyEn: 'Learnova Suite is a production-oriented education marketplace.',
      bodyAr: 'Learnova Suite منصة تعليمية متكاملة.',
      seoTitle: 'About Learnova Suite',
      seoDescription: 'Learn about the platform.'
    }
  });

  await prisma.subscriptionPlan.upsert({
    where: { slug: 'starter' },
    update: {
      name: 'Starter',
      price: 19,
      interval: 'monthly',
      active: true,
      features: toList(['5 courses per month', 'Certificates', 'Student favorites and watchlist'])
    },
    create: {
      name: 'Starter',
      slug: 'starter',
      price: 19,
      interval: 'monthly',
      features: toList(['5 courses per month', 'Certificates', 'Student favorites and watchlist'])
    }
  });

  await prisma.subscriptionPlan.upsert({
    where: { slug: 'growth' },
    update: {
      name: 'Growth',
      price: 49,
      interval: 'monthly',
      active: true,
      features: toList(['Unlimited learning', 'Live sessions', 'Certificates', 'Bundle discounts'])
    },
    create: {
      name: 'Growth',
      slug: 'growth',
      price: 49,
      interval: 'monthly',
      features: toList(['Unlimited learning', 'Live sessions', 'Certificates', 'Bundle discounts'])
    }
  });

  await prisma.subscriptionPlan.upsert({
    where: { slug: 'academy-annual' },
    update: {
      name: 'Academy Annual',
      price: 299,
      interval: 'yearly',
      active: true,
      features: toList(['Annual academy access', 'Priority support', 'Team-ready learning reports'])
    },
    create: {
      name: 'Academy Annual',
      slug: 'academy-annual',
      price: 299,
      interval: 'yearly',
      features: toList(['Annual academy access', 'Priority support', 'Team-ready learning reports'])
    }
  });

  await prisma.courseBundle.upsert({
    where: { slug: 'launch-your-saas-bundle' },
    update: {
      title: 'Launch Your SaaS Bundle',
      description: 'A focused bundle that pairs product design foundations, a production Next.js SaaS build, and mobile delivery.',
      price: 79,
      active: true,
      courseIds: toList([course.id, designCourse.id, extraCourses[0].id])
    },
    create: {
      title: 'Launch Your SaaS Bundle',
      slug: 'launch-your-saas-bundle',
      description: 'A focused bundle that pairs product design foundations, a production Next.js SaaS build, and mobile delivery.',
      price: 79,
      active: true,
      courseIds: toList([course.id, designCourse.id, extraCourses[0].id])
    }
  });

  const gateways = [
    ['Bank Transfer', 'manual', 'Send payment to the bank account and upload receipt.'],
    ['Stripe', 'stripe', 'Stripe sandbox checkout foundation.'],
    ['PayPal', 'paypal', 'PayPal sandbox checkout foundation.'],
    ['Razorpay', 'razorpay', 'Razorpay checkout foundation.'],
    ['Paystack', 'paystack', 'Paystack checkout foundation.'],
    ['Flutterwave', 'flutterwave', 'Flutterwave checkout foundation.'],
    ['Mollie', 'mollie', 'Mollie checkout foundation.'],
    ['Iyzico', 'iyzico', 'Iyzico inline adapter foundation. Use hosted checkout URL for production checkout.'],
    ['Paymob', 'paymob', 'Paymob checkout foundation.'],
    ['Tap Payments', 'tap', 'Tap checkout foundation.'],
    ['HyperPay', 'hyperpay', 'HyperPay inline adapter foundation. Use hosted checkout URL for production checkout.'],
    ['Midtrans', 'midtrans', 'Midtrans checkout foundation.'],
    ['Xendit', 'xendit', 'Xendit checkout foundation.'],
    ['SSLCommerz', 'sslcommerz', 'SSLCommerz checkout foundation.'],
    ['Bank Transfer', 'bank_transfer', 'Bank transfer checkout foundation.'],
    ['Cash on Delivery', 'cod', 'Cash/manual collection checkout foundation.']
  ];

  for (const [name, slug, instructions] of gateways) {
    await prisma.paymentMethod.upsert({
      where: { slug },
      update: { active: true, instructions, config: toJson({ mode: 'sandbox', demo: true }) },
      create: { name, slug, active: true, instructions, config: toJson({ mode: 'sandbox', demo: true }) }
    });
  }

  const languages = languagePresets.map((language) => ({
    code: language.code,
    name: language.nativeName,
    direction: language.direction,
    active: language.code === 'en'
  }));

  for (const language of languages) {
    await prisma.language.upsert({
      where: { code: language.code },
      update: { name: language.name, direction: language.direction, active: language.active },
      create: language
    });
  }

  const currencies = [
    { code: 'USD', symbol: '$', exchangeRate: 1 },
    { code: 'EUR', symbol: '€', exchangeRate: 0.92 },
    { code: 'EGP', symbol: 'E£', exchangeRate: 47.5 },
    { code: 'SAR', symbol: 'SR', exchangeRate: 3.75 }
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: { symbol: currency.symbol, exchangeRate: currency.exchangeRate, active: true },
      create: { ...currency, active: true }
    });
  }

  const integrations = [
    ['google_analytics', { mode: 'sandbox', demo: true, propertyId: '' }],
    ['facebook_pixel', { mode: 'sandbox', demo: true, pixelId: '' }],
    ['zapier', { mode: 'sandbox', demo: true, webhookUrl: 'https://hooks.zapier.com/hooks/catch/demo' }],
    ['mailchimp', { mode: 'sandbox', demo: true, audienceId: 'demo-audience' }],
    ['slack', { mode: 'sandbox', demo: true, channel: '#demo-orders' }]
  ] as const;

  for (const [provider, config] of integrations) {
    await prisma.integrationSetting.upsert({
      where: { provider },
      update: { config: toJson(config), active: true },
      create: { provider, config: toJson(config), active: true }
    });
  }

  const mobileSettings = [
    ['ios', { status: 'demo', demo: true, version: '1.0.0', deepLinks: true }],
    ['android', { status: 'demo', demo: true, version: '1.0.0', deepLinks: true }],
    ['pwa', { status: 'demo', demo: true, version: '1.0.0', installable: true }]
  ] as const;

  for (const [platform, config] of mobileSettings) {
    await prisma.mobileAppSetting.upsert({
      where: { platform },
      update: { config: toJson(config), active: true },
      create: { platform, config: toJson(config), active: true }
    });
  }

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const primaryLessons = seededLessons.slice(0, 4);
  const primaryLessonIds = primaryLessons.map((lesson) => lesson.id);
  const allDemoCourseIds = [course.id, designCourse.id, ...extraCourses.map((demoCourse) => demoCourse.id)];

  await prisma.setting.upsert({
    where: { key: 'ai_assistant' },
    update: {
      value: toJson({
        enabled: true,
        provider: 'demo',
        model: 'demo-site-assistant',
        assistantName: 'Learnova Assistant',
        scope: 'catalog,lessons,checkout,student-progress,support',
        fallback: 'Demo mode is active. Add a provider API key in Admin Settings to use OpenAI, DeepSeek, or a compatible endpoint.'
      })
    },
    create: {
      key: 'ai_assistant',
      value: toJson({
        enabled: true,
        provider: 'demo',
        model: 'demo-site-assistant',
        assistantName: 'Learnova Assistant',
        scope: 'catalog,lessons,checkout,student-progress,support',
        fallback: 'Demo mode is active. Add a provider API key in Admin Settings to use OpenAI, DeepSeek, or a compatible endpoint.'
      })
    }
  });

  await prisma.badgeAward.deleteMany({
    where: { userId: student.id, title: { in: ['First Lesson', '7 Day Streak', 'Quiz Master', 'Portfolio Starter'] } }
  });
  await prisma.badgeAward.createMany({
    data: [
      { userId: student.id, title: 'First Lesson', icon: '1st', reason: 'Completed the first lesson in the main SaaS course.' },
      { userId: student.id, title: '7 Day Streak', icon: '7d', reason: 'Kept learning activity going for a full week.' },
      { userId: student.id, title: 'Quiz Master', icon: 'A+', reason: 'Passed the project setup quiz with a strong score.' },
      { userId: student.id, title: 'Portfolio Starter', icon: 'PRO', reason: 'Published the first portfolio-ready project draft.' }
    ]
  });

  await prisma.learningGoal.deleteMany({
    where: { userId: student.id, title: { in: ['Finish mobile app track', 'Submit portfolio project', 'Pass two quizzes'] } }
  });
  await prisma.learningGoal.createMany({
    data: [
      { userId: student.id, title: 'Finish mobile app track', target: 100, progress: 72, dueDate: new Date(now.getTime() + 14 * day) },
      { userId: student.id, title: 'Submit portfolio project', target: 1, progress: 1, completed: true, dueDate: new Date(now.getTime() + 3 * day) },
      { userId: student.id, title: 'Pass two quizzes', target: 2, progress: 1, dueDate: new Date(now.getTime() + 7 * day) }
    ]
  });

  await prisma.booking.deleteMany({
    where: { studentId: student.id, meetingUrl: { in: ['https://meet.learnova.test/demo-mentor-1', 'https://meet.learnova.test/demo-mentor-2', 'https://meet.learnova.test/demo-mentor-3'] } }
  });
  await prisma.booking.createMany({
    data: [
      {
        instructorId: instructor.id,
        studentId: student.id,
        startsAt: new Date(now.getTime() + 2 * day),
        durationMin: 45,
        status: 'APPROVED',
        notes: 'Demo booking: SaaS dashboard review',
        meetingUrl: 'https://meet.learnova.test/demo-mentor-1'
      },
      {
        instructorId: instructor.id,
        studentId: student.id,
        startsAt: new Date(now.getTime() + 6 * day),
        durationMin: 30,
        status: 'PENDING',
        notes: 'Demo booking: portfolio feedback',
        meetingUrl: 'https://meet.learnova.test/demo-mentor-2'
      },
      {
        instructorId: instructor.id,
        studentId: student.id,
        startsAt: new Date(now.getTime() - 8 * day),
        durationMin: 60,
        status: 'COMPLETED',
        notes: 'Demo booking: onboarding call completed',
        meetingUrl: 'https://meet.learnova.test/demo-mentor-3'
      }
    ]
  });

  for (const [index, lessonId] of primaryLessonIds.entries()) {
    await prisma.lessonBookmark.upsert({
      where: { userId_lessonId: { userId: student.id, lessonId } },
      update: { note: index === 0 ? 'Rewatch before the capstone build.' : 'Useful reference for the next assignment.' },
      create: { userId: student.id, lessonId, note: index === 0 ? 'Rewatch before the capstone build.' : 'Useful reference for the next assignment.' }
    });
  }

  const demoResourceTitles = [
    'SaaS launch checklist',
    'Dashboard wireframe kit',
    'Python reporting dataset',
    'Mobile release QA sheet'
  ];
  await prisma.courseResource.deleteMany({ where: { title: { in: demoResourceTitles } } });
  await prisma.courseResource.createMany({
    data: [
      { courseId: course.id, title: 'SaaS launch checklist', url: '/demo/resources/saas-launch-checklist.pdf', type: 'PDF' },
      { courseId: designCourse.id, title: 'Dashboard wireframe kit', url: '/demo/resources/dashboard-wireframe-kit.fig', type: 'TEMPLATE' },
      { courseId: extraCourses[1].id, title: 'Python reporting dataset', url: '/demo/resources/python-reporting-dataset.csv', type: 'DATASET' },
      { courseId: extraCourses[0].id, title: 'Mobile release QA sheet', url: '/demo/resources/mobile-release-qa-sheet.xlsx', type: 'SHEET' }
    ]
  });

  const growthPlan = await prisma.subscriptionPlan.findUnique({ where: { slug: 'growth' } });
  if (growthPlan) {
    await prisma.subscription.deleteMany({ where: { userId: student.id, planId: growthPlan.id } });
    await prisma.subscription.create({
      data: {
        userId: student.id,
        planId: growthPlan.id,
        startsAt: new Date(now.getTime() - 10 * day),
        endsAt: new Date(now.getTime() + 20 * day),
        status: 'ACTIVE'
      }
    });
  }

  const careerTrack = await prisma.careerTrack.upsert({
    where: { slug: 'full-stack-saas-developer' },
    update: {
      title: 'Full-Stack SaaS Developer',
      description: 'A guided track across Next.js, product design, analytics, and launch readiness.',
      skillIds: toList(['Next.js', 'Payments', 'Dashboards', 'Deployment']),
      active: true
    },
    create: {
      title: 'Full-Stack SaaS Developer',
      slug: 'full-stack-saas-developer',
      description: 'A guided track across Next.js, product design, analytics, and launch readiness.',
      skillIds: toList(['Next.js', 'Payments', 'Dashboards', 'Deployment']),
      active: true
    }
  });
  await prisma.careerTrackEnrollment.upsert({
    where: { careerTrackId_userId: { careerTrackId: careerTrack.id, userId: student.id } },
    update: { status: 'ACTIVE' },
    create: { careerTrackId: careerTrack.id, userId: student.id, status: 'ACTIVE' }
  });

  await prisma.grantApplication.deleteMany({ where: { userId: student.id } });
  await prisma.grantProgram.deleteMany({ where: { title: { in: ['Creator Launch Grant', 'Women in Tech Scholarship'] } } });
  const creatorGrant = await prisma.grantProgram.create({
    data: {
      title: 'Creator Launch Grant',
      description: 'Supports learners who are preparing a real portfolio launch.',
      budget: 2500,
      active: true
    }
  });
  const womenTechGrant = await prisma.grantProgram.create({
    data: {
      title: 'Women in Tech Scholarship',
      description: 'Demo scholarship program for inclusive technical upskilling.',
      budget: 5000,
      active: true
    }
  });
  await prisma.grantApplication.createMany({
    data: [
      {
        grantId: creatorGrant.id,
        userId: student.id,
        statement: 'I am using the SaaS track to launch a public portfolio project.',
        status: 'APPROVED'
      },
      {
        grantId: womenTechGrant.id,
        userId: buyer.id,
        statement: 'I want to move from operations into analytics and product design.',
        status: 'PENDING'
      }
    ]
  });

  await prisma.jobApplication.deleteMany({ where: { userId: student.id } });
  await prisma.jobBoardPost.deleteMany({ where: { title: { in: ['Junior Frontend Developer', 'Product Design Intern', 'Data Analyst Trainee'] } } });
  const frontendJob = await prisma.jobBoardPost.create({
    data: {
      title: 'Junior Frontend Developer',
      company: 'Learnova Labs',
      location: 'Remote',
      url: 'https://jobs.learnova.test/frontend',
      description: 'Build course marketplace dashboards and learner-facing interfaces.',
      active: true
    }
  });
  const designJob = await prisma.jobBoardPost.create({
    data: {
      title: 'Product Design Intern',
      company: 'Moeimtak Studio',
      location: 'Cairo / Remote',
      url: 'https://jobs.learnova.test/design',
      description: 'Assist with learning product UI systems, research notes, and prototype QA.',
      active: true
    }
  });
  await prisma.jobBoardPost.create({
    data: {
      title: 'Data Analyst Trainee',
      company: 'Analytics Bridge',
      location: 'Hybrid',
      url: 'https://jobs.learnova.test/data',
      description: 'Turn demo datasets into weekly business dashboards.',
      active: true
    }
  });
  await prisma.jobApplication.createMany({
    data: [
      {
        jobId: frontendJob.id,
        userId: student.id,
        status: 'INTERVIEW',
        coverNote: 'I completed the Next.js SaaS course and built a dashboard capstone.'
      },
      {
        jobId: designJob.id,
        userId: student.id,
        status: 'APPLIED',
        coverNote: 'I am pairing UI/UX fundamentals with frontend implementation.'
      }
    ]
  });

  await prisma.mentorEnrollment.deleteMany({ where: { userId: student.id } });
  await prisma.mentorProgram.deleteMany({ where: { title: { in: ['SaaS Portfolio Coaching', 'Career Switch Review'] } } });
  const portfolioMentor = await prisma.mentorProgram.create({
    data: {
      title: 'SaaS Portfolio Coaching',
      description: 'Weekly mentor review for capstone scope, UX polish, and deployment blockers.',
      instructorId: instructor.id,
      price: 49,
      active: true
    }
  });
  const careerMentor = await prisma.mentorProgram.create({
    data: {
      title: 'Career Switch Review',
      description: 'Async mentor feedback for CV, portfolio positioning, and application strategy.',
      instructorId: instructor.id,
      price: 29,
      active: true
    }
  });
  await prisma.mentorEnrollment.createMany({
    data: [
      { programId: portfolioMentor.id, userId: student.id, status: 'ACTIVE' },
      { programId: careerMentor.id, userId: student.id, status: 'COMPLETED' }
    ]
  });

  const learningPath = await prisma.learningPath.upsert({
    where: { slug: 'ship-a-learning-marketplace' },
    update: {
      title: 'Ship a Learning Marketplace',
      description: 'A practical path from product design to Next.js delivery and marketing launch.',
      courseIds: toList([course.id, designCourse.id, extraCourses[3].id]),
      active: true
    },
    create: {
      title: 'Ship a Learning Marketplace',
      slug: 'ship-a-learning-marketplace',
      description: 'A practical path from product design to Next.js delivery and marketing launch.',
      courseIds: toList([course.id, designCourse.id, extraCourses[3].id]),
      active: true
    }
  });
  await prisma.learningPathEnrollment.upsert({
    where: { learningPathId_userId: { learningPathId: learningPath.id, userId: student.id } },
    update: { progress: 66 },
    create: { learningPathId: learningPath.id, userId: student.id, progress: 66 }
  });

  for (const skill of [
    { skill: 'Next.js', level: 'intermediate', source: 'course completion' },
    { skill: 'UI Systems', level: 'beginner', source: 'learning path' },
    { skill: 'Product Analytics', level: 'beginner', source: 'quiz and assignments' }
  ]) {
    await prisma.skillProfile.upsert({
      where: { userId_skill: { userId: student.id, skill: skill.skill } },
      update: { level: skill.level, source: skill.source },
      create: { userId: student.id, ...skill }
    });
  }

  await prisma.portfolioProject.deleteMany({ where: { userId: student.id, title: { in: ['Learning marketplace dashboard', 'Course checkout redesign'] } } });
  await prisma.portfolioProject.createMany({
    data: [
      {
        userId: student.id,
        title: 'Learning marketplace dashboard',
        description: 'A student dashboard showing progress, certificates, and live sessions.',
        url: 'https://portfolio.learnova.test/learning-dashboard',
        imageUrl: '/images/course-covers/nextjs-saas-masterclass.png',
        public: true
      },
      {
        userId: student.id,
        title: 'Course checkout redesign',
        description: 'A focused UX case study improving coupon, cart, and receipt clarity.',
        url: 'https://portfolio.learnova.test/checkout-redesign',
        imageUrl: '/images/course-covers/ui-ux-design-fundamentals.png',
        public: true
      }
    ]
  });

  await prisma.resumeProfile.upsert({
    where: { userId: student.id },
    update: {
      headline: 'Junior full-stack learner building SaaS products',
      summary: 'Completed marketplace, design, and analytics learning paths with portfolio projects ready for review.',
      links: toJson(['https://portfolio.learnova.test/omar', 'https://github.com/learnova-demo'])
    },
    create: {
      userId: student.id,
      headline: 'Junior full-stack learner building SaaS products',
      summary: 'Completed marketplace, design, and analytics learning paths with portfolio projects ready for review.',
      links: toJson(['https://portfolio.learnova.test/omar', 'https://github.com/learnova-demo'])
    }
  });

  await prisma.wishlistCollection.deleteMany({ where: { userId: student.id, title: { in: ['Next quarter learning plan', 'Design and analytics shortlist'] } } });
  await prisma.wishlistCollection.createMany({
    data: [
      { userId: student.id, title: 'Next quarter learning plan', courseIds: toList([extraCourses[2].id, extraCourses[3].id, extraCourses[4].id]), public: true },
      { userId: student.id, title: 'Design and analytics shortlist', courseIds: toList([designCourse.id, extraCourses[1].id]), public: false }
    ]
  });

  await prisma.courseMilestone.deleteMany({
    where: { courseId: course.id, title: { in: ['Complete setup module', 'Pass first quiz', 'Submit capstone checklist'] } }
  });
  await prisma.courseMilestone.createMany({
    data: [
      { courseId: course.id, title: 'Complete setup module', sortOrder: 1 },
      { courseId: course.id, title: 'Pass first quiz', sortOrder: 2 },
      { courseId: course.id, title: 'Submit capstone checklist', sortOrder: 3 }
    ]
  });
  const milestones = await prisma.courseMilestone.findMany({ where: { courseId: course.id, title: { in: ['Complete setup module', 'Pass first quiz', 'Submit capstone checklist'] } } });
  for (const milestone of milestones) {
    await prisma.milestoneProgress.upsert({
      where: { milestoneId_userId: { milestoneId: milestone.id, userId: student.id } },
      update: { completed: milestone.sortOrder < 3 },
      create: { milestoneId: milestone.id, userId: student.id, completed: milestone.sortOrder < 3 }
    });
  }

  const quizzes = await prisma.quiz.findMany({ where: { lessonId: { in: primaryLessonIds } } });
  await prisma.quizAttempt.deleteMany({ where: { userId: student.id, quizId: { in: quizzes.map((quiz) => quiz.id) } } });
  if (quizzes.length) {
    await prisma.quizAttempt.createMany({
      data: quizzes.map((quiz, index) => ({
        quizId: quiz.id,
        userId: student.id,
        score: index === 0 ? 92 : 78,
        passed: true,
        createdAt: new Date(now.getTime() - (index + 1) * day)
      }))
    });
  }

  const assignments = await prisma.assignment.findMany({ where: { courseId: course.id } });
  await prisma.assignmentSubmission.deleteMany({ where: { userId: student.id, assignmentId: { in: assignments.map((assignment) => assignment.id) } } });
  if (assignments.length) {
    await prisma.assignmentSubmission.createMany({
      data: assignments.map((assignment) => ({
        assignmentId: assignment.id,
        userId: student.id,
        content: 'Demo submission with environment checklist, screenshots, and release notes.',
        fileUrl: '/demo/submissions/environment-checklist.pdf',
        grade: 88,
        feedback: 'Strong structure. Add one deployment screenshot before final review.'
      }))
    });
  }

  await prisma.calendarEvent.deleteMany({
    where: { userId: student.id, source: 'demo-completeness' }
  });
  await prisma.calendarEvent.createMany({
    data: [
      {
        userId: student.id,
        title: 'Live Q&A: SaaS Architecture',
        startsAt: new Date(now.getTime() + day),
        endsAt: new Date(now.getTime() + day + 60 * 60 * 1000),
        source: 'demo-completeness',
        sourceId: course.id
      },
      {
        userId: student.id,
        title: 'Portfolio review deadline',
        startsAt: new Date(now.getTime() + 5 * day),
        endsAt: new Date(now.getTime() + 5 * day + 30 * 60 * 1000),
        source: 'demo-completeness',
        sourceId: designCourse.id
      }
    ]
  });

  if (paidOrder) {
    await prisma.refundRequest.deleteMany({ where: { userId: student.id, orderId: paidOrder.id } });
    await prisma.refundRequest.create({
      data: {
        userId: student.id,
        orderId: paidOrder.id,
        reason: 'Demo refund request for admin workflow review.',
        status: 'REVIEWING'
      }
    });
  }

  await prisma.abuseReport.deleteMany({
    where: { reporterEmail: { in: ['learner.audit@example.com', 'instructor.audit@example.com', 'guest.audit@example.com'] } }
  });
  await prisma.abuseReport.createMany({
    data: [
      { reporterEmail: 'learner.audit@example.com', targetType: 'course', targetId: course.id, reason: 'Potentially outdated resource link reported by a learner.', status: 'OPEN' },
      { reporterEmail: 'instructor.audit@example.com', targetType: 'review', targetId: 'demo-review-1', reason: 'Review language needs moderation check.', status: 'RESOLVED' },
      { reporterEmail: 'guest.audit@example.com', targetType: 'comment', targetId: 'demo-question-1', reason: 'Spam-like promotional comment detected.', status: 'OPEN' }
    ]
  });

  await prisma.apiKey.deleteMany({ where: { name: { in: ['Demo Reporting API', 'Demo Mobile App API'] } } });
  const reportingApiKey = await prisma.apiKey.create({
    data: { name: 'Demo Reporting API', keyHash: 'demo_hash_reporting_api', active: true }
  });
  await prisma.apiKey.create({
    data: { name: 'Demo Mobile App API', keyHash: 'demo_hash_mobile_api', active: true }
  });
  await prisma.apiUsageLog.deleteMany({
    where: { path: { in: ['/api/v1/courses', '/api/v1/orders', '/api/v1/webhooks/stripe', '/api/v1/student/progress'] } }
  });
  await prisma.apiUsageLog.createMany({
    data: [
      { apiKeyId: reportingApiKey.id, path: '/api/v1/courses', method: 'GET', status: 200, createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000) },
      { apiKeyId: reportingApiKey.id, path: '/api/v1/orders', method: 'GET', status: 200, createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
      { apiKeyId: reportingApiKey.id, path: '/api/v1/webhooks/stripe', method: 'POST', status: 202, createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
      { apiKeyId: null, path: '/api/v1/student/progress', method: 'GET', status: 401, createdAt: new Date(now.getTime() - 60 * 60 * 1000) }
    ]
  });

  await prisma.automationRun.deleteMany({ where: { log: { contains: 'Demo automation' } } });
  await prisma.automationRule.deleteMany({ where: { name: { in: ['Demo order confirmation', 'Demo inactive learner reminder'] } } });
  await prisma.automationRule.create({
    data: {
      name: 'Demo order confirmation',
      trigger: 'order.paid',
      action: 'send.email',
      config: toJson({ target: 'student', message: 'Demo email template: purchase confirmation for order {{orderId}}.' }),
      active: true
    }
  });
  await prisma.automationRule.create({
    data: {
      name: 'Demo inactive learner reminder',
      trigger: 'student.inactive',
      action: 'create.notification',
      config: toJson({ target: 'student', message: 'Demo notification: check in with inactive learner {{userName}} after {{inactiveDays}} days.' }),
      active: true
    }
  });

  await prisma.consentRecord.deleteMany({
    where: { userId: { in: [student.id, buyer.id] }, type: { in: ['marketing_email', 'cookie_analytics', 'terms_acceptance'] } }
  });
  await prisma.consentRecord.createMany({
    data: [
      { userId: student.id, type: 'marketing_email', granted: false, ip: '127.0.0.1' },
      { userId: student.id, type: 'cookie_analytics', granted: true, ip: '127.0.0.1' },
      { userId: buyer.id, type: 'terms_acceptance', granted: true, ip: '127.0.0.1' }
    ]
  });

  await prisma.courseReport.deleteMany({
    where: { userId: { in: [student.id, buyer.id] }, courseId: { in: allDemoCourseIds } }
  });
  await prisma.courseReport.createMany({
    data: [
      { userId: student.id, courseId: course.id, reason: 'One lesson attachment should be checked before the next release.', status: 'OPEN' },
      { userId: buyer.id, courseId: designCourse.id, reason: 'Request for additional captions in a design lesson.', status: 'RESOLVED' }
    ]
  });

  await prisma.pageView.deleteMany({
    where: { path: { in: ['/courses/nextjs-saas-masterclass', '/student/dashboard', '/checkout', '/instructor/dashboard', '/blog/how-to-launch-online-academy'] } }
  });
  await prisma.pageView.createMany({
    data: [
      { path: '/courses/nextjs-saas-masterclass', userId: student.id, referrer: '/courses', createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000) },
      { path: '/student/dashboard', userId: student.id, referrer: '/login', createdAt: new Date(now.getTime() - 7 * 60 * 60 * 1000) },
      { path: '/checkout', userId: buyer.id, referrer: '/cart', createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
      { path: '/instructor/dashboard', userId: instructor.id, referrer: '/login', createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000) },
      { path: '/blog/how-to-launch-online-academy', userId: null, referrer: 'https://demo.learnova.test', createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000) }
    ]
  });

  await prisma.webhookEndpoint.deleteMany({
    where: { url: { in: ['https://hooks.learnova.test/orders', 'https://hooks.learnova.test/certificates'] } }
  });
  const orderWebhook = await prisma.webhookEndpoint.create({
    data: { name: 'Demo Order Fulfillment', url: 'https://hooks.learnova.test/orders', secret: 'demo_order_secret', active: true }
  });
  const certificateWebhook = await prisma.webhookEndpoint.create({
    data: { name: 'Demo Certificate Sync', url: 'https://hooks.learnova.test/certificates', secret: 'demo_certificate_secret', active: true }
  });
  await prisma.webhookDelivery.deleteMany({
    where: { event: { in: ['order.paid', 'certificate.issued', 'subscription.renewal_failed'] } }
  });
  await prisma.webhookDelivery.createMany({
    data: [
      { endpointId: orderWebhook.id, event: 'order.paid', payload: toJson({ orderId: paidOrder?.id || 'demo-order', total: 49 }), status: 'SUCCESS', response: '202 accepted' },
      { endpointId: certificateWebhook.id, event: 'certificate.issued', payload: toJson({ userId: student.id, courseId: course.id }), status: 'SUCCESS', response: '200 ok' },
      { endpointId: orderWebhook.id, event: 'subscription.renewal_failed', payload: toJson({ userId: student.id, plan: 'growth' }), status: 'FAILED', response: 'Demo endpoint timeout' }
    ]
  });

  await prisma.webhookEvent.deleteMany({
    where: {
      OR: [
        { provider: 'stripe', eventId: 'evt_demo_order_paid' },
        { provider: 'paypal', eventId: 'evt_demo_subscription_failed' }
      ]
    }
  });
  await prisma.webhookEvent.createMany({
    data: [
      {
        provider: 'stripe',
        eventId: 'evt_demo_order_paid',
        payload: toJson({ type: 'checkout.session.completed', demo: true }),
        processed: true
      },
      {
        provider: 'paypal',
        eventId: 'evt_demo_subscription_failed',
        payload: toJson({ type: 'billing.subscription.payment_failed', demo: true }),
        processed: false
      }
    ]
  });

  await prisma.dataExportRequest.deleteMany({ where: { userId: student.id } });
  await prisma.dataExportRequest.createMany({
    data: [
      { userId: student.id, status: 'READY', fileUrl: '/demo/privacy/student-export.zip' },
      { userId: buyer.id, status: 'PENDING', fileUrl: null }
    ]
  });
  await prisma.dataDeletionRequest.deleteMany({ where: { userId: student.id } });
  await prisma.dataDeletionRequest.createMany({
    data: [
      { userId: student.id, reason: 'Demo privacy erasure request awaiting admin review.', status: 'PENDING' },
      { userId: buyer.id, reason: 'Demo request completed after account verification.', status: 'COMPLETED' }
    ]
  });

  for (const waitlist of [
    { courseId: course.id, email: 'enterprise.buyer@example.com' },
    { courseId: designCourse.id, email: 'ux.team@example.com' },
    { courseId: extraCourses[2].id, email: 'ai.ops@example.com' }
  ]) {
    await prisma.courseWaitlist.upsert({
      where: { courseId_email: waitlist },
      update: {},
      create: waitlist
    });
  }

  await prisma.releaseChecklist.deleteMany({ where: { sortOrder: { in: [41, 43] } } });
  await prisma.releaseChecklist.createMany({
    data: [
      { sortOrder: 41, title: 'Languages and currencies demo includes English, Arabic, French, Spanish, German, Turkish, Portuguese, plus USD, EUR, EGP, and SAR conversion previews.', done: true },
      { sortOrder: 43, title: 'External integration readiness shows sandbox configs, required live env vars, webhooks, payment gateways, and mobile app release metadata.', done: true }
    ]
  });

  await prisma.setting.upsert({
    where: { key: 'general' },
    update: { value: toJson({ siteName: 'Learnova Suite', currency: 'USD', defaultLanguage: 'en', rtl: false, theme: 'dark' }) },
    create: { key: 'general', value: toJson({ siteName: 'Learnova Suite', currency: 'USD', defaultLanguage: 'en', rtl: false, theme: 'dark' }) }
  });

  await prisma.setting.upsert({
    where: { key: 'theme' },
    update: { value: toJson({ homeTheme: 'theme-7', primary: '#1D9BF0', secondary: '#16181C', radius: '9999px', font: 'Chirp, Inter, system-ui' }) },
    create: { key: 'theme', value: toJson({ homeTheme: 'theme-7', primary: '#1D9BF0', secondary: '#16181C', radius: '9999px', font: 'Chirp, Inter, system-ui' }) }
  });

  await prisma.notificationPreference.upsert({
    where: { userId: student.id },
    update: { email: true, inApp: true, marketing: false, liveReminders: true },
    create: { userId: student.id, email: true, inApp: true, marketing: false, liveReminders: true }
  });

  await prisma.notification.deleteMany({ where: { userId: { in: [student.id, instructor.id, admin.id] } } });
  await prisma.notification.createMany({
    data: [
      {
        userId: student.id,
        title: 'Welcome to your learning inbox',
        body: 'Course announcements, payment updates, certificates, and support replies will appear here.',
        read: false
      },
      {
        userId: student.id,
        title: 'Live session reminder',
        body: 'Next.js SaaS Masterclass office hours starts soon. Check your live sessions page for the join link.',
        read: false
      },
      {
        userId: student.id,
        title: 'Certificate email preferences saved',
        body: 'Certificate and live reminder emails are enabled for this demo account.',
        read: true
      },
      {
        userId: instructor.id,
        title: 'Withdrawal update email queued',
        body: 'A demo payout status email has been added to the email log.',
        read: false
      },
      {
        userId: admin.id,
        title: 'Demo email templates ready',
        body: 'Review transactional email templates and logs from the admin dashboard.',
        read: false
      }
    ]
  });

  await prisma.emailLog.deleteMany({
    where: {
      to: { in: ['student@demo.com', 'instructor@demo.com', 'admin@demo.com'] }
    }
  });
  await prisma.emailLog.createMany({
    data: [
      {
        to: 'student@demo.com',
        subject: 'Your Learnova order is confirmed',
        status: 'SENT',
        meta: toJson({ provider: 'demo', template: 'purchase-confirmation', htmlPreview: 'Your access to Next.js SaaS Masterclass is ready.' })
      },
      {
        to: 'student@demo.com',
        subject: 'Live class starts soon',
        status: 'QUEUED',
        meta: toJson({ provider: 'demo', template: 'live-session-reminder', htmlPreview: 'Next.js SaaS Masterclass office hours starts at 5:00 PM.' })
      },
      {
        to: 'instructor@demo.com',
        subject: 'Withdrawal request update',
        status: 'SENT',
        meta: toJson({ provider: 'demo', template: 'withdrawal-update', htmlPreview: 'Your 120 USD withdrawal request has been approved.' })
      },
      {
        to: 'admin@demo.com',
        subject: 'Support reply failed',
        status: 'FAILED',
        meta: toJson({ provider: 'demo', template: 'support-reply', htmlPreview: 'Mailbox unavailable in demo mode.' })
      }
    ]
  });

  await prisma.certificateTemplate.deleteMany({
    where: { name: { in: ['Modern Border Credential', 'Minimal Verification Sheet'] } }
  });
  await prisma.certificateTemplate.updateMany({ data: { active: false } });
  await prisma.certificateTemplate.createMany({
    data: [
      {
        name: 'Modern Border Credential',
        active: true,
        html: `<div style="font-family: Inter, Arial, sans-serif; background:#fff; color:#111; border:4px solid #111; padding:32px; text-align:center; max-width:1080px; margin:0 auto; box-sizing:border-box; overflow-wrap:break-word;">
  <div style="font-size:13px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#1D9BF0;">{{siteName}}</div>
  <h1 style="margin:22px 0 8px; font-size:38px; line-height:1.05; font-weight:900; word-break:break-word;">Certificate of Completion</h1>
  <p style="margin:20px auto 0; max-width:720px; color:#555; font-size:18px;">This certifies that</p>
  <div style="margin:16px auto 0; font-size:34px; line-height:1.1; font-weight:900; word-break:break-word;">{{student}}</div>
  <p style="margin:22px auto 0; max-width:720px; color:#555; font-size:18px;">has successfully completed</p>
  <div style="margin:14px auto 0; max-width:860px; color:#1D9BF0; font-size:28px; line-height:1.15; font-weight:900; word-break:break-word;">{{course}}</div>
  <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:42px; text-align:left;">
    <div style="border:1px solid #111; padding:16px; flex:1 1 220px;"><strong>Instructor</strong><br><span style="color:#555;">{{instructor}}</span></div>
    <div style="border:1px solid #111; padding:16px; flex:1 1 220px;"><strong>Issued</strong><br><span style="color:#555;">{{issuedAt}}</span></div>
    <div style="border:1px solid #111; padding:16px; flex:1 1 220px;"><strong>Code</strong><br><span style="color:#555;">{{code}}</span></div>
  </div>
  <div style="margin-top:34px; display:flex; align-items:center; justify-content:center; gap:16px; flex-wrap:wrap;">
    <img src="{{qrUrl}}" alt="Verification QR code" style="width:112px; height:112px;">
    <div style="text-align:left; max-width:420px;">
      <strong>Verified credential</strong>
      <p style="margin:6px 0 0; color:#555;">Verify this certificate at {{verifyUrl}}</p>
    </div>
  </div>
</div>`
      },
      {
        name: 'Minimal Verification Sheet',
        active: false,
        html: `<div style="font-family: Inter, Arial, sans-serif; background:#fff; color:#0f1419; border:1px solid #2F3336; padding:48px; max-width:980px; margin:0 auto;">
  <div style="display:flex; justify-content:space-between; gap:24px; border-bottom:1px solid #2F3336; padding-bottom:28px;">
    <div>
      <p style="margin:0; color:#1D9BF0; font-size:12px; font-weight:900; text-transform:uppercase;">{{siteName}}</p>
      <h1 style="margin:12px 0 0; font-size:42px; line-height:1; font-weight:900;">Verified Certificate</h1>
    </div>
    <img src="{{qrUrl}}" alt="Verification QR code" style="width:96px; height:96px;">
  </div>
  <p style="margin:34px 0 0; color:#536471;">Awarded to</p>
  <h2 style="margin:8px 0 0; font-size:40px; line-height:1.1; font-weight:900;">{{student}}</h2>
  <p style="margin:28px 0 0; color:#536471;">For completing</p>
  <h3 style="margin:8px 0 0; color:#1D9BF0; font-size:30px; line-height:1.2; font-weight:900;">{{course}}</h3>
  <div style="display:flex; flex-wrap:wrap; gap:16px; margin-top:38px;">
    <div style="flex:1 1 180px;"><strong>Instructor</strong><br>{{instructor}}</div>
    <div style="flex:1 1 180px;"><strong>Issued</strong><br>{{issuedAt}}</div>
    <div style="flex:1 1 180px;"><strong>Code</strong><br>{{code}}</div>
  </div>
  <p style="margin:34px 0 0; color:#536471;">Verification: {{verifyUrl}}</p>
</div>`
      }
    ]
  });

  await prisma.releaseChecklist.deleteMany({
    where: { title: { in: ['32. Marketing system demo ready', '33. Affiliate program demo ready'] } }
  });

  await Promise.all([
    { key: 'checkout_disabled', description: 'Blocks course, cart, bundle and subscription checkout flows while keeping browsing online.' },
    { key: 'registration_closed', description: 'Stops new public account creation even when registration is enabled in site settings.' },
    { key: 'instructor_registration_closed', description: 'Stops new instructor signups while student registration can remain open.' },
    { key: 'smart_assistant_disabled', description: 'Turns off the public smart assistant instantly without changing provider settings.' },
    { key: 'public_demo_disabled', description: 'Returns 404 for /demo even when DEMO_MODE is enabled for hosted demos.' },
  ].map((flag) => prisma.featureFlag.upsert({
    where: { key: flag.key },
    update: { description: flag.description },
    create: { ...flag, enabled: false },
  })));

  await prisma.experiment.upsert({
    where: { key: 'demo_homepage_headline' },
    update: {
      variants: toJson([{ name: 'outcome_led', weight: 50 }, { name: 'marketplace_led', weight: 50 }]),
      active: true,
    },
    create: {
      key: 'demo_homepage_headline',
      variants: toJson([{ name: 'outcome_led', weight: 50 }, { name: 'marketplace_led', weight: 50 }]),
      active: true,
    },
  });

  await prisma.releaseChecklist.createMany({
    data: [
      { title: '32. Marketing system demo ready', done: true, sortOrder: 32 },
      { title: '33. Affiliate program demo ready', done: true, sortOrder: 33 }
    ]
  });

  for (const addon of defaultAddonCatalog) {
    const app = await prisma.marketplaceApp.upsert({
      where: { slug: addon.slug },
      update: {
        name: addon.name,
        description: addon.description,
        config: addonConfigFromManifest(addon, { source: 'built-in-catalog' }),
        installed: true
      },
      create: {
        name: addon.name,
        slug: addon.slug,
        description: addon.description,
        config: addonConfigFromManifest(addon, { source: 'built-in-catalog' }),
        installed: true
      }
    });

    const existingInstallation = await prisma.appInstallation.findFirst({
      where: { appId: app.id, tenantId: null, userId: null }
    });

    const active = true;
    if (existingInstallation) {
      await prisma.appInstallation.update({
        where: { id: existingInstallation.id },
        data: { active }
      });
    } else {
      await prisma.appInstallation.create({ data: { appId: app.id, active } });
    }
  }

  await prisma.slider.create({
    data: {
      title: 'Launch Your Learning Marketplace',
      subtitle: 'Courses, live classes, subscriptions and certificates in one platform.',
      buttonText: 'Explore Courses',
      buttonUrl: '/courses',
      sortOrder: 1
    }
  }).catch(() => null);

  console.log({ admin: admin.email, instructor: instructor.email, student: student.email, password: 'password123' });
}

main().finally(() => prisma.$disconnect());

