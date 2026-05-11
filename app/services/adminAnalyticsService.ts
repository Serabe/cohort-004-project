import { sql } from "drizzle-orm";
import { db } from "~/db";
import { purchases, enrollments, courses } from "~/db/schema";
import type { RevenueDataPoint, TimePeriod } from "~/services/analyticsService";

export interface AdminAnalyticsSummary {
  totalRevenue: number;
  totalEnrollments: number;
  topCourse: { title: string; revenue: number } | null;
}

function getStartDate(period: TimePeriod): string | null {
  if (period === "all") return null;

  const now = new Date();
  switch (period) {
    case "7d":
      now.setDate(now.getDate() - 7);
      break;
    case "30d":
      now.setDate(now.getDate() - 30);
      break;
    case "12m":
      now.setMonth(now.getMonth() - 12);
      break;
  }
  return now.toISOString();
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function generateDailyKeys(startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    keys.push(formatDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return keys;
}

function generateMonthlyKeys(startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current <= end) {
    keys.push(formatMonthKey(current));
    current.setMonth(current.getMonth() + 1);
  }

  return keys;
}

export function getAdminAnalyticsSummary(opts: {
  period: TimePeriod;
}): AdminAnalyticsSummary {
  const startDate = getStartDate(opts.period);

  const revenueResult = db
    .select({ total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .where(startDate ? sql`${purchases.createdAt} >= ${startDate}` : sql`1 = 1`)
    .get();

  const enrollmentResult = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      startDate ? sql`${enrollments.enrolledAt} >= ${startDate}` : sql`1 = 1`
    )
    .get();

  const topCourseResult = db
    .select({
      title: courses.title,
      revenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .innerJoin(courses, sql`${purchases.courseId} = ${courses.id}`)
    .where(startDate ? sql`${purchases.createdAt} >= ${startDate}` : sql`1 = 1`)
    .groupBy(courses.id)
    .orderBy(sql`sum(${purchases.pricePaid}) DESC`)
    .limit(1)
    .get();

  return {
    totalRevenue: revenueResult?.total ?? 0,
    totalEnrollments: enrollmentResult?.count ?? 0,
    topCourse: topCourseResult
      ? { title: topCourseResult.title, revenue: topCourseResult.revenue }
      : null,
  };
}

export function getAdminRevenueTimeSeries(opts: {
  period: TimePeriod;
}): RevenueDataPoint[] {
  const { period } = opts;
  const now = new Date();
  const startDate = getStartDate(period);
  const useDaily = period === "7d" || period === "30d";

  let rangeStart: Date;
  if (startDate) {
    rangeStart = new Date(startDate);
  } else {
    const earliest = db
      .select({ minDate: sql<string | null>`min(${purchases.createdAt})` })
      .from(purchases)
      .get();

    if (!earliest?.minDate) return [];
    rangeStart = new Date(earliest.minDate);
  }

  const keys = useDaily
    ? generateDailyKeys(rangeStart, now)
    : generateMonthlyKeys(rangeStart, now);
  const groupExpr = useDaily
    ? sql<string>`substr(${purchases.createdAt}, 1, 10)`
    : sql<string>`substr(${purchases.createdAt}, 1, 7)`;

  const rows = db
    .select({
      dateKey: groupExpr,
      revenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .where(startDate ? sql`${purchases.createdAt} >= ${startDate}` : sql`1 = 1`)
    .groupBy(groupExpr)
    .all();

  const revenueByDate = new Map(rows.map((row) => [row.dateKey, row.revenue]));

  return keys.map((key) => ({
    date: key,
    revenue: revenueByDate.get(key) ?? 0,
  }));
}
