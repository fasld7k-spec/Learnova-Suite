from pathlib import Path
import json
# 1) Ensure .env exists and use SQLite for immediate local preview without Docker/Postgres
env = Path('.env')
if not env.exists():
    env.write_text('''DATABASE_URL="file:./dev.db"
JWT_SECRET="local-dev-secret-change-before-production"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
PLATFORM_COMMISSION_PERCENT="15"
STRIPE_SECRET_KEY=""
PAYPAL_CLIENT_ID=""
PAYPAL_CLIENT_SECRET=""
SMTP_HOST=""
SMTP_USER=""
SMTP_PASS=""
''', encoding='utf-8')
else:
    s = env.read_text(encoding='utf-8')
    if 'DATABASE_URL=' in s:
        import re
        s = re.sub(r'DATABASE_URL=.*', 'DATABASE_URL="file:./dev.db"', s)
    else:
        s = 'DATABASE_URL="file:./dev.db"\n' + s
    if 'JWT_SECRET=' not in s:
        s += '\nJWT_SECRET="local-dev-secret-change-before-production"\n'
    if 'NEXT_PUBLIC_APP_URL=' not in s:
        s += '\nNEXT_PUBLIC_APP_URL="http://localhost:3000"\n'
    env.write_text(s, encoding='utf-8')

# 2) Backup PostgreSQL schema and create local SQLite-compatible schema subset for preview
schema = Path('prisma/schema.prisma')
backup = Path('prisma/schema.postgres.prisma')
if not backup.exists():
    backup.write_text(schema.read_text(encoding='utf-8'), encoding='utf-8')

sqlite_schema = r'''
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite" url = env("DATABASE_URL") }

enum Role { ADMIN INSTRUCTOR STUDENT }
enum ApprovalStatus { PENDING APPROVED REJECTED }
enum CourseStatus { DRAFT PENDING PUBLISHED REJECTED ARCHIVED }
enum LessonType { VIDEO TEXT QUIZ }
enum PaymentStatus { PENDING PAID FAILED REFUNDED }
enum WithdrawalStatus { PENDING APPROVED REJECTED PAID }
enum LiveProvider { ZOOM GOOGLE_MEET EXTERNAL }

model User { id String @id @default(cuid()) name String email String @unique passwordHash String role Role @default(STUDENT) avatar String? bio String? locale String @default("en") status ApprovalStatus @default(APPROVED) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt courses Course[] enrollments Enrollment[] questions Question[] reviews Review[] notifications Notification[] payouts Withdrawal[] certificates Certificate[] }
model Category { id String @id @default(cuid()) nameEn String nameAr String slug String @unique courses Course[] createdAt DateTime @default(now()) }
model Course { id String @id @default(cuid()) title String slug String @unique shortDescription String fullDescription String coverImage String? promoVideo String? price Decimal @default(0) salePrice Decimal? language String @default("en") level String @default("beginner") durationMinutes Int @default(0) requirements String @default("[]") outcomes String @default("[]") status CourseStatus @default(PENDING) isFree Boolean @default(false) instructorId String instructor User @relation(fields:[instructorId], references:[id]) categoryId String category Category @relation(fields:[categoryId], references:[id]) modules Module[] liveSessions LiveSession[] enrollments Enrollment[] reviews Review[] questions Question[] createdAt DateTime @default(now()) updatedAt DateTime @updatedAt }
model Module { id String @id @default(cuid()) title String sortOrder Int @default(0) courseId String course Course @relation(fields:[courseId], references:[id], onDelete:Cascade) lessons Lesson[] }
model Lesson { id String @id @default(cuid()) title String type LessonType @default(VIDEO) videoUrl String? content String? attachmentUrl String? durationMinutes Int @default(0) isPreview Boolean @default(false) sortOrder Int @default(0) moduleId String module Module @relation(fields:[moduleId], references:[id], onDelete:Cascade) progresses LessonProgress[] }
model Enrollment { id String @id @default(cuid()) userId String user User @relation(fields:[userId], references:[id]) courseId String course Course @relation(fields:[courseId], references:[id]) progress Int @default(0) completedAt DateTime? createdAt DateTime @default(now()) certificate Certificate? @@unique([userId, courseId]) }
model LessonProgress { id String @id @default(cuid()) userId String lessonId String lesson Lesson @relation(fields:[lessonId], references:[id]) completed Boolean @default(false) updatedAt DateTime @updatedAt @@unique([userId, lessonId]) }
model LiveSession { id String @id @default(cuid()) title String description String? startsAt DateTime durationMinutes Int provider LiveProvider url String courseId String? course Course? @relation(fields:[courseId], references:[id]) instructorId String createdAt DateTime @default(now()) }
model Order { id String @id @default(cuid()) userId String total Decimal currency String @default("USD") status PaymentStatus @default(PENDING) gateway String invoiceNumber String @unique items OrderItem[] payment Payment? createdAt DateTime @default(now()) }
model OrderItem { id String @id @default(cuid()) orderId String order Order @relation(fields:[orderId], references:[id], onDelete:Cascade) courseId String title String price Decimal commission Decimal instructorEarning Decimal }
model Payment { id String @id @default(cuid()) orderId String @unique order Order @relation(fields:[orderId], references:[id]) gateway String transactionId String? status PaymentStatus @default(PENDING) metadata Json? createdAt DateTime @default(now()) }
model Coupon { id String @id @default(cuid()) code String @unique percent Int active Boolean @default(true) expiresAt DateTime? }
model Review { id String @id @default(cuid()) rating Int comment String? userId String user User @relation(fields:[userId], references:[id]) courseId String course Course @relation(fields:[courseId], references:[id]) createdAt DateTime @default(now()) @@unique([userId, courseId]) }
model Question { id String @id @default(cuid()) title String body String answer String? userId String user User @relation(fields:[userId], references:[id]) courseId String course Course @relation(fields:[courseId], references:[id]) createdAt DateTime @default(now()) }
model Certificate { id String @id @default(cuid()) code String @unique userId String user User @relation(fields:[userId], references:[id]) enrollmentId String @unique enrollment Enrollment @relation(fields:[enrollmentId], references:[id]) courseTitle String instructorName String issuedAt DateTime @default(now()) }
model Withdrawal { id String @id @default(cuid()) instructorId String instructor User @relation(fields:[instructorId], references:[id]) amount Decimal method String status WithdrawalStatus @default(PENDING) createdAt DateTime @default(now()) }
model Notification { id String @id @default(cuid()) userId String user User @relation(fields:[userId], references:[id]) title String body String read Boolean @default(false) createdAt DateTime @default(now()) }
model Setting { key String @id value Json updatedAt DateTime @updatedAt }
model Page { id String @id @default(cuid()) slug String @unique titleEn String titleAr String bodyEn String bodyAr String seoTitle String? seoDescription String? }
model BlogPost { id String @id @default(cuid()) slug String @unique title String excerpt String content String coverImage String? published Boolean @default(false) createdAt DateTime @default(now()) }
model PaymentMethod { id String @id @default(cuid()) name String slug String @unique config Json? active Boolean @default(false) instructions String? }
model WebhookEvent { id String @id @default(cuid()) provider String eventId String? payload Json processed Boolean @default(false) createdAt DateTime @default(now()) }
model Favorite { id String @id @default(cuid()) userId String courseId String createdAt DateTime @default(now()) @@unique([userId, courseId]) }
model SubscriptionPlan { id String @id @default(cuid()) name String slug String @unique price Decimal interval String features String @default("[]") active Boolean @default(true) createdAt DateTime @default(now()) subscriptions Subscription[] }
model Subscription { id String @id @default(cuid()) userId String planId String plan SubscriptionPlan @relation(fields:[planId], references:[id]) startsAt DateTime @default(now()) endsAt DateTime status String @default("ACTIVE") createdAt DateTime @default(now()) }
model Slider { id String @id @default(cuid()) title String subtitle String? image String? buttonText String? buttonUrl String? active Boolean @default(true) sortOrder Int @default(0) }
model Language { id String @id @default(cuid()) code String @unique name String direction String @default("ltr") active Boolean @default(true) }
model Currency { id String @id @default(cuid()) code String @unique symbol String exchangeRate Decimal @default(1) active Boolean @default(true) }
model CouponRedemption { id String @id @default(cuid()) couponId String userId String orderId String? createdAt DateTime @default(now()) }
model CourseView { id String @id @default(cuid()) courseId String userId String? ip String? createdAt DateTime @default(now()) }
model SupportTicket { id String @id @default(cuid()) userId String? name String email String subject String message String status String @default("OPEN") createdAt DateTime @default(now()) }
'''
schema.write_text(sqlite_schema.strip()+"\n", encoding='utf-8')

# 3) Override seed with SQLite-compatible demo seed
Path('prisma/seed.ts').write_text(r'''
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main(){
  const passwordHash = await bcrypt.hash('password123', 12);
  const admin = await prisma.user.upsert({where:{email:'admin@demo.com'},update:{},create:{name:'Demo Admin',email:'admin@demo.com',passwordHash,role:'ADMIN'}});
  const instructor = await prisma.user.upsert({where:{email:'instructor@demo.com'},update:{},create:{name:'Sarah Instructor',email:'instructor@demo.com',passwordHash,role:'INSTRUCTOR',status:'APPROVED',bio:'Senior full-stack educator and product mentor'}});
  const student = await prisma.user.upsert({where:{email:'student@demo.com'},update:{},create:{name:'Omar Student',email:'student@demo.com',passwordHash,role:'STUDENT'}});
  const web = await prisma.category.upsert({where:{slug:'web-development'},update:{},create:{nameEn:'Web Development',nameAr:'تطوير الويب',slug:'web-development'}});
  const design = await prisma.category.upsert({where:{slug:'design'},update:{},create:{nameEn:'Design',nameAr:'التصميم',slug:'design'}});
  const course = await prisma.course.upsert({where:{slug:'nextjs-saas-masterclass'},update:{},create:{title:'Next.js SaaS Masterclass',slug:'nextjs-saas-masterclass',shortDescription:'Build production-ready SaaS apps using Next.js.',fullDescription:'A complete practical course for building SaaS applications, dashboards, payments, SEO and deployment.',price:99,salePrice:49,language:'en',level:'intermediate',durationMinutes:480,requirements:JSON.stringify(['Basic JavaScript','React fundamentals']),outcomes:JSON.stringify(['Build dashboards','Create secure APIs','Integrate payments','Ship production apps']),status:'PUBLISHED',instructorId:instructor.id,categoryId:web.id,modules:{create:[{title:'Getting Started',sortOrder:1,lessons:{create:[{title:'Course Overview',type:'VIDEO',videoUrl:'https://example.com/video.mp4',durationMinutes:8,isPreview:true},{title:'Project Setup',type:'TEXT',content:'Install Node.js and configure environment.',durationMinutes:15}]}},{title:'Marketplace Core',sortOrder:2,lessons:{create:[{title:'Course APIs',type:'VIDEO',durationMinutes:25},{title:'Checkout Flow',type:'VIDEO',durationMinutes:30}]}}]}}});
  await prisma.course.upsert({where:{slug:'ui-ux-design-fundamentals'},update:{},create:{title:'UI/UX Design Fundamentals',slug:'ui-ux-design-fundamentals',shortDescription:'Learn modern product design and UX workflows.',fullDescription:'Master user research, wireframes, design systems and usability.',price:79,salePrice:29,language:'en',level:'beginner',durationMinutes:360,requirements:JSON.stringify(['No prior design experience']),outcomes:JSON.stringify(['Create wireframes','Build design systems','Run usability reviews']),status:'PUBLISHED',instructorId:instructor.id,categoryId:design.id,modules:{create:[{title:'UX Foundations',sortOrder:1,lessons:{create:[{title:'User Research',type:'TEXT',content:'Research methods and personas.',durationMinutes:20},{title:'Wireframing',type:'VIDEO',durationMinutes:25}]}}]}}});
  await prisma.enrollment.upsert({where:{userId_courseId:{userId:student.id,courseId:course.id}},update:{progress:35},create:{userId:student.id,courseId:course.id,progress:35}});
  await prisma.liveSession.create({data:{title:'Weekly Q&A: SaaS Architecture',description:'Live class for enrolled students',startsAt:new Date(Date.now()+86400000),durationMinutes:60,provider:'EXTERNAL',url:'https://meet.google.com/demo',courseId:course.id,instructorId:instructor.id}});
  await prisma.coupon.upsert({where:{code:'WELCOME25'},update:{},create:{code:'WELCOME25',percent:25}});
  await prisma.review.upsert({where:{userId_courseId:{userId:student.id,courseId:course.id}},update:{},create:{userId:student.id,courseId:course.id,rating:5,comment:'Excellent practical SaaS course.'}});
  await prisma.question.create({data:{userId:student.id,courseId:course.id,title:'Do we deploy to Vercel?',body:'Is Vercel suitable for production?',answer:'Yes, Vercel with managed PostgreSQL is a great option.'}}).catch(()=>null);
  await prisma.blogPost.upsert({where:{slug:'how-to-launch-online-academy'},update:{},create:{slug:'how-to-launch-online-academy',title:'How to Launch an Online Academy',excerpt:'A practical checklist for launching your education business.',content:'Choose a niche, prepare content, onboard instructors, configure payments and launch with SEO.',published:true}});
  await prisma.page.upsert({where:{slug:'about'},update:{},create:{slug:'about',titleEn:'About Learnova Suite',titleAr:'عن المنصة',bodyEn:'Learnova Suite is a complete education marketplace.',bodyAr:'Learnova Suite منصة تعليمية متكاملة.',seoTitle:'About Learnova Suite',seoDescription:'Learn about the platform.'}});
  await prisma.subscriptionPlan.upsert({where:{slug:'growth'},update:{},create:{name:'Growth',slug:'growth',price:49,interval:'monthly',features:JSON.stringify(['Unlimited learning','Live sessions','Certificates'])}});
  for(const m of [
    ['Bank Transfer','manual','Send payment to the bank account and upload receipt.'],['Stripe','stripe','Stripe sandbox checkout foundation.'],['PayPal','paypal','PayPal sandbox checkout foundation.'],['Razorpay','razorpay','Razorpay checkout foundation.'],['Paystack','paystack','Paystack checkout foundation.'],['Flutterwave','flutterwave','Flutterwave checkout foundation.']
  ]) await prisma.paymentMethod.upsert({where:{slug:m[1]},update:{active:true},create:{name:m[0],slug:m[1],active:true,instructions:m[2]}});
  await prisma.setting.upsert({where:{key:'general'},update:{value:{siteName:'Learnova Suite',currency:'USD',rtl:true,theme:'light'}},create:{key:'general',value:{siteName:'Learnova Suite',currency:'USD',rtl:true,theme:'light'}}});
  await prisma.slider.create({data:{title:'Launch Your Learning Marketplace',subtitle:'Courses, live classes, subscriptions and certificates in one platform.',buttonText:'Explore Courses',buttonUrl:'/courses',sortOrder:1}}).catch(()=>null);
  console.log({admin:admin.email,instructor:instructor.email,student:student.email,password:'password123'});
}
main().finally(()=>prisma.$disconnect());
''', encoding='utf-8')
print('Local SQLite setup files prepared.')
