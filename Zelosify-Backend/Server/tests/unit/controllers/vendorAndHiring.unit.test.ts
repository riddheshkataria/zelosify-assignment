import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../../src/config/prisma/prisma.js";
import {
  getVendorOpenings,
  getVendorOpeningDetails,
  presignVendorUploadUrls,
  submitVendorProfiles,
  softDeleteVendorProfile,
} from "../../../src/controllers/vendor/vendorOpeningsController.js";
import {
  getManagerOpenings,
  getOpeningProfiles,
  shortlistProfile,
  rejectProfile,
} from "../../../src/controllers/hiring/hiringManagerController.js";

// Helper to create mock Express request and response
function createMockContext(user: any, params = {}, query = {}, body = {}) {
  const req = {
    user,
    params,
    query,
    body,
  } as any;

  let statusCode = 200;
  let responseData: any = null;

  const res = {
    status: vi.fn((code: number) => {
      statusCode = code;
      return res;
    }),
    json: vi.fn((data: any) => {
      responseData = data;
      return res;
    }),
  } as any;

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

describe("Phase 4: Backend REST APIs Controller Unit & Functional Tests", () => {
  const tenantId = "tenant-wayne-corp-111";
  const otherTenantId = "tenant-other-corp-222";
  const vendorUser = {
    id: "vendor-user-123",
    role: "IT_VENDOR",
    tenant: { tenantId, companyName: "Bruce Wayne Corp" },
  };
  const otherVendorUser = {
    id: "vendor-user-999",
    role: "IT_VENDOR",
    tenant: { tenantId, companyName: "Bruce Wayne Corp" },
  };
  const managerUser = {
    id: "manager-lucius-456",
    role: "HIRING_MANAGER",
    tenant: { tenantId, companyName: "Bruce Wayne Corp" },
  };
  const unauthorizedManager = {
    id: "manager-intruder-789",
    role: "HIRING_MANAGER",
    tenant: { tenantId, companyName: "Bruce Wayne Corp" },
  };

  const testOpeningId = "op-uuid-101";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("IT Vendor API Endpoints", () => {
    it("1. getVendorOpenings should return paginated openings strictly for caller tenant", async () => {
      vi.spyOn(prisma.opening, "count").mockResolvedValue(14 as any);
      vi.spyOn(prisma.opening, "findMany").mockResolvedValue([
        {
          id: testOpeningId,
          tenantId,
          title: "Senior Full Stack Engineer",
          description: "React and Node.js",
          location: "Remote",
          contractType: "C2C",
          experienceMin: 5,
          experienceMax: 8,
          hiringManagerId: managerUser.id,
          status: "OPEN",
          postedDate: new Date(),
        },
      ] as any);
      vi.spyOn(prisma.user, "findMany").mockResolvedValue([
        { id: managerUser.id, firstName: "Lucius", lastName: "Fox" },
      ] as any);

      const ctx = createMockContext(vendorUser, {}, { page: "1", limit: "10" });
      await getVendorOpenings(ctx.req, ctx.res);

      expect(ctx.getStatus()).toBe(200);
      const data = ctx.getData();
      expect(data.success).toBe(true);
      expect(data.data.length).toBe(1);
      expect(data.data[0].hiringManagerName).toBe("Lucius Fox");
      expect(data.pagination.total).toBe(14);
    });

    it("2. getVendorOpeningDetails should return details and only profiles uploaded by caller with AI fields stripped", async () => {
      vi.spyOn(prisma.opening, "findUnique").mockResolvedValue({
        id: testOpeningId,
        tenantId,
        title: "Cloud Infrastructure Architect",
        hiringManagerId: managerUser.id,
        experienceMin: 8,
        experienceMax: 12,
      } as any);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        firstName: "Lucius",
        lastName: "Fox",
      } as any);
      vi.spyOn(prisma.hiringProfile, "count").mockResolvedValue(5 as any);
      vi.spyOn(prisma.hiringProfile, "findMany").mockResolvedValue([
        {
          id: 1,
          openingId: testOpeningId,
          s3Key: `${tenantId}/${testOpeningId}/resume.pdf`,
          fileName: "candidate_alex.pdf",
          uploadedBy: vendorUser.id,
          status: "SUBMITTED",
          // Sensitive AI fields that MUST NOT leak to vendor
          recommended: true,
          recommendationScore: 0.88,
          recommendationReason: "Strong candidate match",
        },
      ] as any);

      const ctx = createMockContext(vendorUser, { id: testOpeningId });
      await getVendorOpeningDetails(ctx.req, ctx.res);

      expect(ctx.getStatus()).toBe(200);
      const data = ctx.getData();
      expect(data.success).toBe(true);
      expect(data.data.opening.hiringManagerName).toBe("Lucius Fox");
      expect(data.data.opening.profilesCount).toBe(5);

      const profiles = data.data.uploadedProfiles;
      expect(profiles.length).toBe(1);
      expect(profiles[0].fileName).toBe("candidate_alex.pdf");
      // Check AI fields stripped
      expect(profiles[0].recommended).toBeUndefined();
      expect(profiles[0].recommendationScore).toBeUndefined();
      expect(profiles[0].recommendationReason).toBeUndefined();
    });

    it("3. presignVendorUploadUrls should return upload tokens for valid files", async () => {
      vi.spyOn(prisma.opening, "findUnique").mockResolvedValue({
        id: testOpeningId,
        tenantId,
      } as any);

      const ctx = createMockContext(
        vendorUser,
        { id: testOpeningId },
        {},
        { filenames: ["engineer_resume.pdf"] }
      );
      await presignVendorUploadUrls(ctx.req, ctx.res);

      expect(ctx.getStatus()).toBe(200);
      const data = ctx.getData();
      expect(data.success).toBe(true);
      expect(data.data.uploadTokens.length).toBe(1);
      expect(data.data.uploadTokens[0].filename).toBe("engineer_resume.pdf");
    });

    it("4. submitVendorProfiles should write profiles atomically via Prisma transaction", async () => {
      vi.spyOn(prisma.opening, "findUnique").mockResolvedValue({
        id: testOpeningId,
        tenantId,
      } as any);

      const mockCreated = {
        id: 99,
        openingId: testOpeningId,
        s3Key: `${tenantId}/${testOpeningId}/resume.pdf`,
        fileName: "resume.pdf",
        uploadedBy: vendorUser.id,
        status: "SUBMITTED",
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        const tx = {
          hiringProfile: {
            create: vi.fn().mockResolvedValue(mockCreated),
          },
        };
        return callback(tx);
      });

      const ctx = createMockContext(
        vendorUser,
        { id: testOpeningId },
        {},
        { profiles: [{ s3Key: `${tenantId}/${testOpeningId}/resume.pdf`, fileName: "resume.pdf" }] }
      );

      await submitVendorProfiles(ctx.req, ctx.res);

      expect(ctx.getStatus()).toBe(201);
      const data = ctx.getData();
      expect(data.success).toBe(true);
      expect(data.data[0].id).toBe(99);
      expect(data.data[0].status).toBe("SUBMITTED");
    });

    it("5. softDeleteVendorProfile should allow vendor to delete own profile and reject other vendor deletion", async () => {
      vi.spyOn(prisma.hiringProfile, "findUnique").mockResolvedValue({
        id: 42,
        uploadedBy: vendorUser.id,
      } as any);
      vi.spyOn(prisma.hiringProfile, "update").mockResolvedValue({
        id: 42,
        isDeleted: true,
      } as any);

      // Successful soft delete by owner
      const ctx1 = createMockContext(vendorUser, { id: "42" });
      await softDeleteVendorProfile(ctx1.req, ctx1.res);
      expect(ctx1.getStatus()).toBe(200);
      expect(ctx1.getData().data.isDeleted).toBe(true);

      // Rejection when unauthorized vendor tries to delete
      const ctx2 = createMockContext(otherVendorUser, { id: "42" });
      await softDeleteVendorProfile(ctx2.req, ctx2.res);
      expect(ctx2.getStatus()).toBe(403);
    });
  });

  describe("Hiring Manager API Endpoints", () => {
    it("1. getManagerOpenings should return only openings assigned to caller manager", async () => {
      vi.spyOn(prisma.opening, "findMany").mockResolvedValue([
        {
          id: testOpeningId,
          tenantId,
          hiringManagerId: managerUser.id,
          title: "Principal AI/ML Engineer",
          experienceMin: 7,
          experienceMax: 12,
          status: "OPEN",
          postedDate: new Date(),
          _count: { hiringProfiles: 3 },
        },
      ] as any);

      const ctx = createMockContext(managerUser);
      await getManagerOpenings(ctx.req, ctx.res);

      expect(ctx.getStatus()).toBe(200);
      const data = ctx.getData();
      expect(data.success).toBe(true);
      expect(data.data[0].title).toBe("Principal AI/ML Engineer");
      expect(data.data[0].profilesCount).toBe(3);
    });

    it("2. getOpeningProfiles should return candidate profiles with complete AI badges, scores, and explanation", async () => {
      vi.spyOn(prisma.opening, "findUnique").mockResolvedValue({
        id: testOpeningId,
        tenantId,
        hiringManagerId: managerUser.id,
      } as any);

      vi.spyOn(prisma.hiringProfile, "findMany").mockResolvedValue([
        {
          id: 101,
          openingId: testOpeningId,
          s3Key: "path/candidate.pdf",
          fileName: "candidate.pdf",
          uploadedBy: "vendor-1",
          status: "SUBMITTED",
          recommended: true,
          recommendationScore: 0.86,
          recommendationConfidence: 0.92,
          recommendationReason: "Strong skill overlap (85%)",
          recommendationLatencyMs: 1100,
          submittedAt: new Date(),
        },
      ] as any);

      const ctx = createMockContext(managerUser, { id: testOpeningId });
      await getOpeningProfiles(ctx.req, ctx.res);

      expect(ctx.getStatus()).toBe(200);
      const data = ctx.getData();
      expect(data.success).toBe(true);
      const p = data.data.profiles[0];
      expect(p.recommendationBadge).toBe("RECOMMENDED");
      expect(p.score).toBe(86);
      expect(p.confidence).toBe(92);
      expect(p.explanation).toContain("Strong skill overlap");
      expect(p.latencyMs).toBe(1100);
    });

    it("3. shortlistProfile should update status to SHORTLISTED and record manager ID", async () => {
      vi.spyOn(prisma.hiringProfile, "findUnique").mockResolvedValue({
        id: 101,
        opening: {
          tenantId,
          hiringManagerId: managerUser.id,
        },
      } as any);

      vi.spyOn(prisma.hiringProfile, "update").mockResolvedValue({
        id: 101,
        status: "SHORTLISTED",
        shortlistedBy: managerUser.id,
      } as any);

      const ctx = createMockContext(managerUser, { id: "101" });
      await shortlistProfile(ctx.req, ctx.res);

      expect(ctx.getStatus()).toBe(200);
      expect(ctx.getData().data.status).toBe("SHORTLISTED");
    });

    it("4. shortlistProfile should reject with 403 when manager does not own the opening", async () => {
      vi.spyOn(prisma.hiringProfile, "findUnique").mockResolvedValue({
        id: 101,
        opening: {
          tenantId,
          hiringManagerId: managerUser.id, // belongs to Lucius
        },
      } as any);

      // Caller is unauthorizedManager (intruder)
      const ctx = createMockContext(unauthorizedManager, { id: "101" });
      await shortlistProfile(ctx.req, ctx.res);

      expect(ctx.getStatus()).toBe(403);
    });

    it("5. rejectProfile should update status to REJECTED and record manager ID", async () => {
      vi.spyOn(prisma.hiringProfile, "findUnique").mockResolvedValue({
        id: 101,
        opening: {
          tenantId,
          hiringManagerId: managerUser.id,
        },
      } as any);

      vi.spyOn(prisma.hiringProfile, "update").mockResolvedValue({
        id: 101,
        status: "REJECTED",
        rejectedBy: managerUser.id,
      } as any);

      const ctx = createMockContext(managerUser, { id: "101" });
      await rejectProfile(ctx.req, ctx.res);

      expect(ctx.getStatus()).toBe(200);
      expect(ctx.getData().data.status).toBe("REJECTED");
    });
  });
});
