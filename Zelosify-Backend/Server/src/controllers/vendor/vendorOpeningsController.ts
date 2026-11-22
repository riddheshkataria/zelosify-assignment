import type { Request, Response } from "express";
import prisma from "../../config/prisma/prisma.js";
import { FilePresignService } from "../../services/upload/filePresignService.js";
import { RecommendationService } from "../../services/aiAgent/recommendationService.js";
import {
  getTenantIdFromRequest,
  getUserIdFromRequest,
  assertTenantOwnership,
  assertVendorProfileOwnership,
  sanitizeProfileForVendor,
} from "../../utils/RBAC/tenantOwnership.js";

const filePresignService = new FilePresignService();

/**
 * 1. Fetch Openings for IT Vendor
 * GET /api/v1/vendor/openings
 * Requires IT_VENDOR role. Mandatory tenant filtering. Supports pagination.
 */
export async function getVendorOpenings(req: Request, res: Response) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    const search = (req.query.search as string)?.trim();
    const contractType = req.query.contractType as string;

    const where: any = {
      tenantId,
      status: "OPEN",
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }

    if (contractType) {
      where.contractType = contractType;
    }

    const [total, openings] = await Promise.all([
      prisma.opening.count({ where }),
      prisma.opening.findMany({
        where,
        skip,
        take: limit,
        orderBy: { postedDate: "desc" },
      }),
    ]);

    // Fetch hiring manager names for each opening
    const managerIds = Array.from(new Set(openings.map((o) => o.hiringManagerId)));
    const managers = await prisma.user.findMany({
      where: { id: { in: managerIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const managerMap = new Map(managers.map((m) => [m.id, `${m.firstName || ""} ${m.lastName || ""}`.trim()]));

    const enrichedOpenings = openings.map((op) => ({
      ...op,
      hiringManagerName: managerMap.get(op.hiringManagerId) || "Hiring Team",
    }));

    return res.status(200).json({
      success: true,
      data: enrichedOpenings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("[Vendor Controller] Error fetching openings:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch openings",
    });
  }
}

/**
 * 2. Fetch Opening Details for IT Vendor
 * GET /api/v1/vendor/openings/:id
 * Must include: Hiring Manager name, experience range, profiles count, own uploaded profiles list.
 */
export async function getVendorOpeningDetails(req: Request, res: Response) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    const opening = await prisma.opening.findUnique({
      where: { id },
    });

    if (!opening) {
      return res.status(404).json({ success: false, message: "Opening not found" });
    }

    // Assert Tenant Scoping
    assertTenantOwnership(tenantId, opening.tenantId, "Opening");

    // Fetch hiring manager name
    const manager = await prisma.user.findUnique({
      where: { id: opening.hiringManagerId },
      select: { firstName: true, lastName: true },
    });
    const hiringManagerName = manager ? `${manager.firstName} ${manager.lastName}`.trim() : "Hiring Team";

    // Count all active candidate profiles submitted to this opening
    const totalProfilesCount = await prisma.hiringProfile.count({
      where: { openingId: id, isDeleted: false },
    });

    // Query profiles uploaded ONLY by this vendor caller
    const vendorProfiles = await prisma.hiringProfile.findMany({
      where: {
        openingId: id,
        uploadedBy: userId,
        isDeleted: false,
      },
      orderBy: { submittedAt: "desc" },
    });

    // Strip sensitive AI recommendation fields
    const sanitizedProfiles = vendorProfiles.map((p) => sanitizeProfileForVendor(p));

    return res.status(200).json({
      success: true,
      data: {
        opening: {
          ...opening,
          hiringManagerName,
          experienceRange: `${opening.experienceMin} - ${opening.experienceMax || "Any"} yrs`,
          profilesCount: totalProfilesCount,
        },
        uploadedProfiles: sanitizedProfiles,
      },
    });
  } catch (error: any) {
    console.error("[Vendor Controller] Error fetching opening details:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch opening details",
    });
  }
}

/**
 * 3. Presign Upload URLs for IT Vendor
 * POST /api/v1/vendor/openings/:id/profiles/presign
 * Generates presigned S3 URLs under: <bucket>/<tenantId>/<openingId>/<timestamp>_<filename>
 */
export async function presignVendorUploadUrls(req: Request, res: Response) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = req.params;
    const { filenames } = req.body;

    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({
        success: false,
        message: "filenames array is required and must not be empty",
      });
    }

    // Validate opening exists and belongs to tenant
    const opening = await prisma.opening.findUnique({ where: { id } });
    if (!opening) {
      return res.status(404).json({ success: false, message: "Opening not found" });
    }
    assertTenantOwnership(tenantId, opening.tenantId, "Opening");

    // Generate upload tokens
    const uploadTokens = await filePresignService.generateUploadTokens(filenames, {
      tenantId,
      s3KeyConfig: {
        pathSegments: [tenantId, id],
        includeTimestamp: true,
      },
      uploadEndpoint: `/api/v1/vendor/openings/${id}/profiles/upload`,
    });

    return res.status(200).json({
      success: true,
      data: { uploadTokens },
    });
  } catch (error: any) {
    console.error("[Vendor Controller] Error generating presigned upload URLs:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to generate presigned upload URLs",
    });
  }
}

/**
 * 4. Submit Profiles for IT Vendor
 * POST /api/v1/vendor/openings/:id/profiles/upload
 * Must use a Prisma transaction. Automatically triggers async AI evaluation.
 */
export async function submitVendorProfiles(req: Request, res: Response) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;
    const { profiles } = req.body;

    if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "profiles array is required and must contain at least one profile object",
      });
    }

    const opening = await prisma.opening.findUnique({ where: { id } });
    if (!opening) {
      return res.status(404).json({ success: false, message: "Opening not found" });
    }
    assertTenantOwnership(tenantId, opening.tenantId, "Opening");

    // Atomic Prisma Transaction write
    const createdProfiles = await prisma.$transaction(async (tx) => {
      const records = [];
      for (const p of profiles) {
        if (!p.s3Key) {
          throw new Error("Each profile must contain an s3Key");
        }
        const fileName = p.fileName || p.s3Key.split("/").pop();

        const created = await tx.hiringProfile.create({
          data: {
            openingId: id,
            s3Key: p.s3Key,
            fileName,
            uploadedBy: userId,
            status: "SUBMITTED",
          },
        });
        records.push(created);
      }
      return records;
    });

    // Asynchronously trigger AI recommendation for each profile without blocking HTTP response
    for (const created of createdProfiles) {
      RecommendationService.triggerAsyncEvaluation(created.id);
    }

    const sanitizedCreated = createdProfiles.map((p) => sanitizeProfileForVendor(p));

    return res.status(201).json({
      success: true,
      message: "Profiles submitted successfully. AI evaluation triggered.",
      data: sanitizedCreated,
    });
  } catch (error: any) {
    console.error("[Vendor Controller] Error submitting profiles:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to submit candidate profiles",
    });
  }
}

/**
 * 5. Soft Delete Profile for IT Vendor
 * PATCH /api/v1/vendor/profiles/:id/soft-delete
 */
export async function softDeleteVendorProfile(req: Request, res: Response) {
  try {
    const userId = getUserIdFromRequest(req);
    const profileId = parseInt(req.params.id, 10);

    if (isNaN(profileId)) {
      return res.status(400).json({ success: false, message: "Invalid profile ID" });
    }

    const profile = await prisma.hiringProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    // Verify caller uploaded this profile
    assertVendorProfileOwnership(userId, profile.uploadedBy);

    const updated = await prisma.hiringProfile.update({
      where: { id: profileId },
      data: { isDeleted: true },
    });

    return res.status(200).json({
      success: true,
      message: "Candidate profile soft deleted successfully",
      data: { id: updated.id, isDeleted: updated.isDeleted },
    });
  } catch (error: any) {
    console.error("[Vendor Controller] Error soft deleting profile:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to soft delete profile",
    });
  }
}
