import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  getAdminAnalyticsSummary,
  type AdminAnalyticsSummary,
} from "./adminAnalyticsService";

describe("adminAnalyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("getAdminAnalyticsSummary", () => {
    it("returns zeros and no top course when there are no purchases or enrollments", () => {
      const result = getAdminAnalyticsSummary({ period: "all" });

      expect(result.totalRevenue).toBe(0);
      expect(result.totalEnrollments).toBe(0);
      expect(result.topCourse).toBeNull();
    });

    it("returns total revenue across all instructors", () => {
      const instructor2 = testDb
        .insert(schema.users)
        .values({
          name: "Instructor 2",
          email: "instructor2@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Another course",
          instructorId: instructor2.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 2999,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
          },
          {
            userId: base.user.id,
            courseId: course2.id,
            pricePaid: 2999,
            country: "US",
          },
        ])
        .run();

      const result = getAdminAnalyticsSummary({ period: "all" });

      expect(result.totalRevenue).toBe(7998);
    });

    it("returns total enrollments across all courses", () => {
      testDb
        .insert(schema.enrollments)
        .values([
          { userId: base.user.id, courseId: base.course.id },
          { userId: base.instructor.id, courseId: base.course.id },
        ])
        .run();

      const result = getAdminAnalyticsSummary({ period: "all" });

      expect(result.totalEnrollments).toBe(2);
    });

    it("returns the top earning course", () => {
      const instructor2 = testDb
        .insert(schema.users)
        .values({
          name: "Instructor 2",
          email: "instructor2@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Popular Course",
          slug: "popular-course",
          description: "The best seller",
          instructorId: instructor2.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 9999,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
          },
          {
            userId: base.user.id,
            courseId: course2.id,
            pricePaid: 9999,
            country: "US",
          },
          {
            userId: base.instructor.id,
            courseId: course2.id,
            pricePaid: 9999,
            country: "US",
          },
        ])
        .run();

      const result = getAdminAnalyticsSummary({ period: "all" });

      expect(result.topCourse).not.toBeNull();
      expect(result.topCourse!.title).toBe("Popular Course");
      expect(result.topCourse!.revenue).toBe(19998);
    });

    it("filters by 7d period", () => {
      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(now.getDate() - 3);
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(now.getDate() - 10);

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
            createdAt: threeDaysAgo.toISOString(),
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            pricePaid: 2500,
            country: "US",
            createdAt: tenDaysAgo.toISOString(),
          },
        ])
        .run();

      const result = getAdminAnalyticsSummary({ period: "7d" });

      expect(result.totalRevenue).toBe(4999);
    });

    it("filters enrollments by 30d period", () => {
      const now = new Date();
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(now.getDate() - 10);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(now.getDate() - 60);

      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: tenDaysAgo.toISOString(),
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            enrolledAt: sixtyDaysAgo.toISOString(),
          },
        ])
        .run();

      const result = getAdminAnalyticsSummary({ period: "30d" });

      expect(result.totalEnrollments).toBe(1);
    });

    it("returns null top course when no purchases exist in the period", () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: twoYearsAgo.toISOString(),
        })
        .run();

      const result = getAdminAnalyticsSummary({ period: "7d" });

      expect(result.topCourse).toBeNull();
    });
  });
});
