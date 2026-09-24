from pathlib import Path
schema = r'''
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  INSTRUCTOR
  STUDENT
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

enum CourseStatus {
  DRAFT
  PENDING
  PUBLISHED
  REJECTED
  ARCHIVED
}

enum LessonType {
  VIDEO
  TEXT
  QUIZ
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

enum WithdrawalStatus {
  PENDING
  APPROVED
  REJECTED
  PAID
}

enum LiveProvider {
  ZOOM
  GOOGLE_MEET
  EXTERNAL
}

model User {
  id           String         @id @default(cuid())
  name         String
  email        String         @unique
  passwordHash String
  role         Role           @default(STUDENT)
  avatar       String?
  bio          String?
  locale       String         @default("en")
  status       ApprovalStatus @default(APPROVED)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  courses      Course[]
  enrollments  Enrollment[]
  questions    Question[]
  reviews      Review[]
  notifications Notification[]
  payouts      Withdrawal[]
  certificates Certificate[]
}

model Category {
  id        String   @id @default(cuid())
  nameEn    String
  nameAr    String
  slug      String   @unique
  courses   Course[]
  createdAt DateTime @default(now())
}

model Course {
  id               String       @id @default(cuid())
  title            String
  slug             String       @unique
  shortDescription String
  fullDescription  String
  coverImage       String?
  promoVideo       String?
  price            Decimal      @default(0)
  salePrice        Decimal?
  language         String       @default("en")
  level            String       @default("beginner")
  durationMinutes  Int          @default(0)
  requirements     Json
  outcomes         Json
  status           CourseStatus @default(PENDING)
  isFree           Boolean      @default(false)
  instructorId     String
  instructor       User         @relation(fields: [instructorId], references: [id])
  categoryId       String
  category         Category     @relation(fields: [categoryId], references: [id])
  modules          Module[]
  liveSessions     LiveSession[]
  enrollments      Enrollment[]
  reviews          Review[]
  questions        Question[]
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
}

model Module {
  id        String   @id @default(cuid())
  title     String
  sortOrder Int      @default(0)
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lessons   Lesson[]
}

model Lesson {
  id              String           @id @default(cuid())
  title           String
  type            LessonType       @default(VIDEO)
  videoUrl        String?
  content         String?
  attachmentUrl   String?
  durationMinutes Int              @default(0)
  isPreview       Boolean          @default(false)
  sortOrder       Int              @default(0)
  moduleId        String
  module          Module           @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  progresses      LessonProgress[]
}

model Enrollment {
  id          String       @id @default(cuid())
  userId      String
  user        User         @relation(fields: [userId], references: [id])
  courseId    String
  course      Course       @relation(fields: [courseId], references: [id])
  progress    Int          @default(0)
  completedAt DateTime?
  createdAt   DateTime     @default(now())
  certificate Certificate?
  @@unique([userId, courseId])
}

model LessonProgress {
  id        String   @id @default(cuid())
  userId    String
  lessonId  String
  lesson    Lesson   @relation(fields: [lessonId], references: [id])
  completed Boolean  @default(false)
  updatedAt DateTime @updatedAt
  @@unique([userId, lessonId])
}

model LiveSession {
  id              String       @id @default(cuid())
  title           String
  description     String?
  startsAt        DateTime
  durationMinutes Int
  provider        LiveProvider
  url             String
  courseId        String?
  course          Course?      @relation(fields: [courseId], references: [id])
  instructorId    String
  createdAt       DateTime     @default(now())
}

model Order {
  id            String        @id @default(cuid())
  userId        String
  total         Decimal
  currency      String        @default("USD")
  status        PaymentStatus @default(PENDING)
  gateway       String
  invoiceNumber String        @unique
  items         OrderItem[]
  payment       Payment?
  createdAt     DateTime      @default(now())
}

model OrderItem {
  id                String  @id @default(cuid())
  orderId           String
  order             Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  courseId          String
  title             String
  price             Decimal
  commission        Decimal
  instructorEarning Decimal
}

model Payment {
  id            String        @id @default(cuid())
  orderId       String        @unique
  order         Order         @relation(fields: [orderId], references: [id])
  gateway       String
  transactionId String?
  status        PaymentStatus @default(PENDING)
  metadata      Json?
  createdAt     DateTime      @default(now())
}

model Coupon {
  id        String    @id @default(cuid())
  code      String    @unique
  percent   Int
  active    Boolean   @default(true)
  expiresAt DateTime?
}

model Review {
  id        String   @id @default(cuid())
  rating    Int
  comment   String?
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id])
  createdAt DateTime @default(now())
  @@unique([userId, courseId])
}

model Question {
  id        String   @id @default(cuid())
  title     String
  body      String
  answer    String?
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id])
  createdAt DateTime @default(now())
}

model Certificate {
  id             String     @id @default(cuid())
  code           String     @unique
  userId         String
  user           User       @relation(fields: [userId], references: [id])
  enrollmentId   String     @unique
  enrollment     Enrollment @relation(fields: [enrollmentId], references: [id])
  courseTitle    String
  instructorName String
  issuedAt       DateTime   @default(now())
}

model Withdrawal {
  id           String           @id @default(cuid())
  instructorId String
  instructor   User             @relation(fields: [instructorId], references: [id])
  amount       Decimal
  method       String
  status       WithdrawalStatus @default(PENDING)
  createdAt    DateTime         @default(now())
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  title     String
  body      String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}

model Setting {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt
}

model Page {
  id             String  @id @default(cuid())
  slug           String  @unique
  titleEn        String
  titleAr        String
  bodyEn         String
  bodyAr         String
  seoTitle       String?
  seoDescription String?
}

model BlogPost {
  id         String   @id @default(cuid())
  slug       String   @unique
  title      String
  excerpt    String
  content    String
  coverImage String?
  published  Boolean  @default(false)
  createdAt  DateTime @default(now())
}

model PaymentMethod {
  id           String  @id @default(cuid())
  name         String
  slug         String  @unique
  config       Json?
  active       Boolean @default(false)
  instructions String?
}

model WebhookEvent {
  id        String   @id @default(cuid())
  provider  String
  eventId   String?
  payload   Json
  processed Boolean  @default(false)
  createdAt DateTime @default(now())
}

model Favorite {
  id        String   @id @default(cuid())
  userId    String
  courseId  String
  createdAt DateTime @default(now())
  @@unique([userId, courseId])
}

model SubscriptionPlan {
  id            String         @id @default(cuid())
  name          String
  slug          String         @unique
  price         Decimal
  interval      String
  features      Json
  active        Boolean        @default(true)
  createdAt     DateTime       @default(now())
  subscriptions Subscription[]
}

model Subscription {
  id        String           @id @default(cuid())
  userId    String
  planId    String
  plan      SubscriptionPlan @relation(fields: [planId], references: [id])
  startsAt  DateTime         @default(now())
  endsAt    DateTime
  status    String           @default("ACTIVE")
  createdAt DateTime         @default(now())
}

model Slider {
  id         String  @id @default(cuid())
  title      String
  subtitle   String?
  image      String?
  buttonText String?
  buttonUrl  String?
  active     Boolean @default(true)
  sortOrder  Int     @default(0)
}

model Language {
  id        String  @id @default(cuid())
  code      String  @unique
  name      String
  direction String  @default("ltr")
  active    Boolean @default(true)
}

model Currency {
  id           String  @id @default(cuid())
  code         String  @unique
  symbol       String
  exchangeRate Decimal @default(1)
  active       Boolean @default(true)
}

model CouponRedemption {
  id        String   @id @default(cuid())
  couponId  String
  userId    String
  orderId   String?
  createdAt DateTime @default(now())
}

model CourseView {
  id        String   @id @default(cuid())
  courseId  String
  userId    String?
  ip        String?
  createdAt DateTime @default(now())
}

model SupportTicket {
  id        String   @id @default(cuid())
  userId    String?
  name      String
  email     String
  subject   String
  message   String
  status    String   @default("OPEN")
  createdAt DateTime @default(now())
}
'''
Path('prisma/schema.prisma').write_text(schema.strip()+"\n", encoding='utf-8')
print('fixed sqlite schema formatting')
