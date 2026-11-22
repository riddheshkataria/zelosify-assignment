import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../src/config/prisma/prisma.js";
import {
  presignVendorUploadUrls,
  submitVendorProfiles,
  getVendorOpeningDetails,
} from "../../src/controllers/vendor/vendorOpeningsController.js";
import {
  getOpeningProfiles,
  shortlistProfile,
  rejectProfile,
} from "../../src/controllers/hiring/hiringManagerController.js";
import { RecommendationService } from "../../src/services/aiAgent/recommendationService.js";

function createMockContext(user: any, params = {}, query = {}, body = {}) {
  let statusCode = 200;
  let responseData: any = null;

  const req = { user, params, query, body } as any;
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

describe("Phase 5: Full End-to-End Integration Flow", () => {
  const tenantId = "tenant-e2e-111";
  const vendorUser = {
    id: "vendor-e2e-user",
    role: "IT_VENDOR",
    tenant: { tenantId, companyName: "Bruce Wayne Corp" },
  };
  const managerUser = {
    id: "manager-e2e-user",
    role: "HIRING_MANAGER",
    tenant: { tenantId, companyName: "Bruce Wayne Corp" },
  };

  const openingId = "op-e2e-999";
  let createdProfileId: number;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Stage 1: IT Vendor presigns candidate upload URL", async () => {
    vi.spyOn(prisma.opening, "findUnique").mockResolvedValue({
      id: openingId,
      tenantId,
      title: "Senior Full Stack Engineer",
    } as any);

    const ctx = createMockContext(
      vendorUser,
      { id: openingId },
      {},
      { filenames: ["senior_engineer_cv.pdf"] }
    );

    await presignVendorUploadUrls(ctx.req, ctx.res);

    expect(ctx.getStatus()).toBe(200);
    const data = ctx.getData();
    expect(data.success).toBe(true);
    expect(data.data.uploadTokens.length).toBe(1);
    expect(data.data.uploadTokens[0].filename).toBe("senior_engineer_cv.pdf");
  });

  it("Stage 2: IT Vendor submits uploaded profile with atomic transaction", async () => {
    vi.spyOn(prisma.opening, "findUnique").mockResolvedValue({
      id: openingId,
      tenantId,
      title: "Senior Full Stack Engineer",
    } as any);

    const mockProfileRecord = {
      id: 777,
      openingId,
      s3Key: `${tenantId}/${openingId}/12345_senior_engineer_cv.pdf`,
      fileName: "senior_engineer_cv.pdf",
      uploadedBy: vendorUser.id,
      status: "SUBMITTED",
      isDeleted: false,
      submittedAt: new Date(),
    };

    createdProfileId = mockProfileRecord.id;

    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
      const tx = {
        hiringProfile: {
          create: vi.fn().mockResolvedValue(mockProfileRecord),
        },
      };
      return cb(tx);
    });

    const triggerSpy = vi.spyOn(RecommendationService, "triggerAsyncEvaluation").mockImplementation(() => {});

    const ctx = createMockContext(
      vendorUser,
      { id: openingId },
      {},
      {
        profiles: [
          {
            s3Key: `${tenantId}/${openingId}/12345_senior_engineer_cv.pdf`,
            fileName: "senior_engineer_cv.pdf",
          },
        ],
      }
    );

    await submitVendorProfiles(ctx.req, ctx.res);

    expect(ctx.getStatus()).toBe(201);
    expect(triggerSpy).toHaveBeenCalledWith(777);
  });

  it("Stage 3: Hiring Manager views opening and sees candidate with AI recommendations", async () => {
    vi.spyOn(prisma.opening, "findUnique").mockResolvedValue({
      id: openingId,
      tenantId,
      hiringManagerId: managerUser.id,
      title: "Senior Full Stack Engineer",
      experienceMin: 5,
      experienceMax: 8,
    } as any);

    vi.spyOn(prisma.hiringProfile, "findMany").mockResolvedValue([
      {
        id: 777,
        openingId,
        fileName: "senior_engineer_cv.pdf",
        s3Key: `${tenantId}/${openingId}/12345_senior_engineer_cv.pdf`,
        uploadedBy: vendorUser.id,
        status: "SUBMITTED",
        recommended: true,
        recommendationScore: 0.88,
        recommendationConfidence: 0.94,
        recommendationReason: "Strong candidate match: 80% skill match, experience in range.",
        recommendationLatencyMs: 820,
        submittedAt: new Date(),
      },
    ] as any);

    const ctx = createMockContext(managerUser, { id: openingId });
    await getOpeningProfiles(ctx.req, ctx.res);

    expect(ctx.getStatus()).toBe(200);
    const data = ctx.getData();
    expect(data.data.profiles.length).toBe(1);

    const profile = data.data.profiles[0];
    expect(profile.recommendationBadge).toBe("RECOMMENDED");
    expect(profile.score).toBe(88);
    expect(profile.confidence).toBe(94);
    expect(profile.latencyMs).toBe(820);
  });

  it("Stage 4: Hiring Manager shortlists candidate profile", async () => {
    vi.spyOn(prisma.hiringProfile, "findUnique").mockResolvedValue({
      id: 777,
      opening: {
        tenantId,
        hiringManagerId: managerUser.id,
      },
    } as any);

    vi.spyOn(prisma.hiringProfile, "update").mockResolvedValue({
      id: 777,
      status: "SHORTLISTED",
      shortlistedBy: managerUser.id,
      shortlistedAt: new Date(),
    } as any);

    const ctx = createMockContext(managerUser, { id: "777" });
    await shortlistProfile(ctx.req, ctx.res);

    expect(ctx.getStatus()).toBe(200);
    expect(ctx.getData().data.status).toBe("SHORTLISTED");
  });

  it("Stage 5: Vendor views opening details and sees candidate with AI details hidden", async () => {
    vi.spyOn(prisma.opening, "findUnique").mockResolvedValue({
      id: openingId,
      tenantId,
      hiringManagerId: managerUser.id,
      experienceMin: 5,
      experienceMax: 8,
    } as any);

    vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
      firstName: "Lucius",
      lastName: "Fox",
    } as any);

    vi.spyOn(prisma.hiringProfile, "count").mockResolvedValue(1 as any);
    vi.spyOn(prisma.hiringProfile, "findMany").mockResolvedValue([
      {
        id: 777,
        openingId,
        fileName: "senior_engineer_cv.pdf",
        uploadedBy: vendorUser.id,
        status: "SHORTLISTED",
        recommended: true,
        recommendationScore: 0.88,
        recommendationReason: "Secret AI reasoning",
      },
    ] as any);

    const ctx = createMockContext(vendorUser, { id: openingId });
    await getVendorOpeningDetails(ctx.req, ctx.res);

    expect(ctx.getStatus()).toBe(200);
    const data = ctx.getData();
    const vendorProfile = data.data.uploadedProfiles[0];

    // Status is updated to SHORTLISTED, but AI fields remain strictly stripped
    expect(vendorProfile.status).toBe("SHORTLISTED");
    expect(vendorProfile.recommended).toBeUndefined();
    expect(vendorProfile.recommendationScore).toBeUndefined();
    expect(vendorProfile.recommendationReason).toBeUndefined();
  });
});
