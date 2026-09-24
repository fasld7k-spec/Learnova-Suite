import { couponLabel } from '@/lib/coupons';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import type { Prisma } from '@prisma/client';

type OrderWithItems = {
  createdAt: Date;
  total: unknown;
  items: {
    courseId: string;
    title: string;
    price: unknown;
    instructorEarning: unknown;
  }[];
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const monthKey = (date: Date) => date.toISOString().slice(0, 7);
const money = (value: unknown) => Number(value || 0);

function addAmount<T extends { revenue: number; orders?: number }>(bucket: T, amount: number) {
  bucket.revenue += amount;
  if (typeof bucket.orders === 'number') {
    bucket.orders += 1;
  }
}

function buildSalesSeries(orders: OrderWithItems[]) {
  const daily = new Map<string, { date: string; revenue: number; orders: number }>();
  const monthly = new Map<string, { month: string; revenue: number; orders: number }>();

  for (const order of orders) {
    const total = money(order.total);
    const dKey = dayKey(order.createdAt);
    const mKey = monthKey(order.createdAt);
    addAmount(daily.get(dKey) ?? daily.set(dKey, { date: dKey, revenue: 0, orders: 0 }).get(dKey)!, total);
    addAmount(monthly.get(mKey) ?? monthly.set(mKey, { month: mKey, revenue: 0, orders: 0 }).get(mKey)!, total);
  }

  return {
    dailySales: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14),
    monthlySales: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-6)
  };
}

const reportSourceLabel = 'Live database';
const reportSections: string[] = [];

export type AdminReportFilters = {
  from?: Date | null;
  to?: Date | null;
  status?: string;
  instructorId?: string | null;
  courseId?: string | null;
  categoryId?: string | null;
};

export async function getAdminReportData(filters: AdminReportFilters = {}) {
  const paidStatus = filters.status && filters.status !== 'ALL' ? filters.status : 'PAID';
  const createdAt: Prisma.DateTimeFilter | undefined = filters.from || filters.to ? { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } : undefined;
  const courseWhere: Prisma.CourseWhereInput = {
    ...(filters.courseId ? { id: filters.courseId } : {}),
    ...(filters.instructorId ? { instructorId: filters.instructorId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
  };
  const hasCourseFilters = Boolean(filters.courseId || filters.instructorId || filters.categoryId);
  const courses = await prisma.course.findMany({
    where: hasCourseFilters ? courseWhere : undefined,
    select: { id: true, title: true, instructorId: true, instructor: { select: { name: true } } },
  });
  const filteredCourseIds = new Set(courses.map((course) => course.id));
  const courseIdFilter = hasCourseFilters ? { courseId: { in: [...filteredCourseIds] } } : undefined;
  const orderWhere: Prisma.OrderWhereInput = {
    status: paidStatus,
    ...(createdAt ? { createdAt } : {}),
    ...(courseIdFilter ? { items: { some: courseIdFilter } } : {}),
  };
  const enrollmentWhere: Prisma.EnrollmentWhereInput = {
    ...(createdAt ? { createdAt } : {}),
    ...(courseIdFilter ? { courseId: courseIdFilter.courseId } : {}),
  };
  const progressWhere: Prisma.LessonProgressWhereInput = { completed: true, ...(createdAt ? { updatedAt: createdAt } : {}) };
  const redemptionWhere: Prisma.CouponRedemptionWhereInput = {
    ...(createdAt ? { createdAt } : {}),
    order: { status: 'PAID', ...(courseIdFilter ? { items: { some: courseIdFilter } } : {}) },
  };
  const [orders, enrollments, lessonProgress, coupons, redemptions, instructors, students, withdrawals, settings] = await Promise.all([
    prisma.order.findMany({ where: orderWhere, include: { items: true }, orderBy: { createdAt: 'asc' } }),
    prisma.enrollment.findMany({ where: enrollmentWhere, include: { course: { select: { id: true, title: true, instructorId: true } } } }),
    prisma.lessonProgress.findMany({ where: progressWhere, orderBy: { updatedAt: 'desc' }, take: 500 }),
    prisma.coupon.findMany(),
    prisma.couponRedemption.findMany({ where: redemptionWhere, orderBy: { createdAt: 'desc' }, take: 250 }),
    prisma.user.findMany({ where: { role: 'INSTRUCTOR' }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: 'STUDENT' }, select: { id: true, name: true } }),
    prisma.withdrawal.findMany(),
    getSiteSettings()
  ]);

  const filteredOrders = orders.map((order) => ({
    ...order,
    items: hasCourseFilters ? order.items.filter((item) => filteredCourseIds.has(item.courseId)) : order.items,
    total: hasCourseFilters
      ? order.items.filter((item) => filteredCourseIds.has(item.courseId)).reduce((sum, item) => sum + money(item.price), 0)
      : order.total,
  }));

  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const topCourses = new Map<string, { title: string; revenue: number; sales: number; enrollments: number; completionRate: number }>();

  for (const enrollment of enrollments) {
    const current = topCourses.get(enrollment.courseId) ?? {
      title: enrollment.course.title,
      revenue: 0,
      sales: 0,
      enrollments: 0,
      completionRate: 0
    };
    current.enrollments += 1;
    topCourses.set(enrollment.courseId, current);
  }

  for (const order of filteredOrders) {
    for (const item of order.items) {
      const current = topCourses.get(item.courseId) ?? {
        title: item.title,
        revenue: 0,
        sales: 0,
        enrollments: 0,
        completionRate: 0
      };
      current.revenue += money(item.price);
      current.sales += 1;
      topCourses.set(item.courseId, current);
    }
  }

  const completionsByCourse = new Map<string, number>();
  for (const enrollment of enrollments) {
    if (enrollment.completedAt) {
      completionsByCourse.set(enrollment.courseId, (completionsByCourse.get(enrollment.courseId) ?? 0) + 1);
    }
  }

  for (const [courseId, course] of topCourses) {
    course.completionRate = course.enrollments ? Math.round(((completionsByCourse.get(courseId) ?? 0) / course.enrollments) * 100) : 0;
  }

  const activeStudents = new Map<string, { completedLessons: number; lastActive: Date }>();
  for (const progress of lessonProgress) {
    const current = activeStudents.get(progress.userId) ?? { completedLessons: 0, lastActive: progress.updatedAt };
    current.completedLessons += 1;
    if (progress.updatedAt > current.lastActive) {
      current.lastActive = progress.updatedAt;
    }
    activeStudents.set(progress.userId, current);
  }

  const instructorEarnings = new Map<string, { instructor: string; revenue: number; earnings: number; paidOut: number }>();
  for (const instructor of instructors) {
    instructorEarnings.set(instructor.id, { instructor: instructor.name, revenue: 0, earnings: 0, paidOut: 0 });
  }
  for (const order of filteredOrders) {
    for (const item of order.items) {
      const instructorId = courseMap.get(item.courseId)?.instructorId;
      if (!instructorId) continue;
      const current = instructorEarnings.get(instructorId) ?? { instructor: courseMap.get(item.courseId)?.instructor.name ?? 'Instructor', revenue: 0, earnings: 0, paidOut: 0 };
      current.revenue += money(item.price);
      current.earnings += money(item.instructorEarning);
      instructorEarnings.set(instructorId, current);
    }
  }
  for (const withdrawal of withdrawals) {
    const current = instructorEarnings.get(withdrawal.instructorId);
    if (current && withdrawal.status === 'APPROVED') {
      current.paidOut += money(withdrawal.amount);
    }
  }

  const couponMap = new Map(coupons.map((coupon) => [coupon.id, coupon]));
  const studentMap = new Map(students.map((student) => [student.id, student.name]));
  const couponUsage = coupons.map((coupon) => ({
    code: coupon.code,
    percent: coupon.percent,
    discount: couponLabel(coupon, settings.currency),
    active: coupon.active,
    redemptions: redemptions.filter((redemption) => redemption.couponId === coupon.id).length
  }));

  const completionRate = enrollments.length ? Math.round((enrollments.filter((enrollment) => enrollment.completedAt).length / enrollments.length) * 100) : 0;
  const realTopCourses = [...topCourses.values()].sort((a, b) => b.revenue - a.revenue || b.enrollments - a.enrollments).slice(0, 5);
  const realActiveStudents = [...activeStudents.entries()]
    .map(([userId, row]) => ({ userId, ...row }))
    .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime())
    .slice(0, 5);
  const realInstructorEarnings = [...instructorEarnings.values()].filter((row) => row.revenue || row.earnings || row.paidOut).sort((a, b) => b.earnings - a.earnings).slice(0, 5);
  const sales = filteredOrders.length ? buildSalesSeries(filteredOrders) : { dailySales: [], monthlySales: [] };

  return {
    summary: {
      revenue: filteredOrders.reduce((sum, order) => sum + money(order.total), 0),
      paidOrders: filteredOrders.length,
      enrollments: enrollments.length,
      completionRate,
      couponRedemptions: redemptions.length,
      activeStudents: activeStudents.size
    },
    ...sales,
    demoData: {
      enabled: false,
      usesSyntheticFallback: false,
      sourceLabel: reportSourceLabel,
      sections: reportSections,
    },
    topCourses: realTopCourses,
    activeStudentRows: realActiveStudents.length ? realActiveStudents.map((row) => ({
      student: studentMap.get(row.userId) ?? 'Student',
      completedLessons: row.completedLessons,
      lastActive: row.lastActive.toISOString().slice(0, 10)
    })) : [],
    couponUsage,
    recentCouponRedemptions: redemptions.slice(0, 5).map((redemption) => ({
      code: couponMap.get(redemption.couponId)?.code ?? redemption.couponId,
      userId: redemption.userId,
      orderId: redemption.orderId ?? '-',
      date: redemption.createdAt.toISOString().slice(0, 10)
    })),
    instructorEarnings: realInstructorEarnings
  };
}
