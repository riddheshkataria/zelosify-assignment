import type { Request, Response } from "express";
import prisma from "../../config/prisma/prisma.js";
import { createStorageService } from "../../services/storage/storageFactory.js";
import {
  getTenantIdFromRequest,
  getUserIdFromRequest,
  assertTenantOwnership,
  assertHiringManagerOwnership,
} from "../../utils/RBAC/tenantOwnership.js";

/**
 * 1. Fetch Openings for Hiring Manager
 * GET /api/v1/hiring-manager/openings
 * Only returns openings belonging to this logged-in hiring manager.
 */
export async function getManagerOpenings(req: Request, res: Response) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const userId = getUserIdFromRequest(req);

    const openings = await prisma.opening.findMany({
      where: {
        tenantId,
        hiringManagerId: userId,
      },
      include: {
        _count: {
          select: {
            hiringProfiles: {
              where: { isDeleted: false },
            },
          },
        },
      },
      orderBy: { postedDate: "desc" },
    });

    const formatted = openings.map((op) => ({
      id: op.id,
      title: op.title,
      description: op.description,
      location: op.location,
      contractType: op.contractType,
      experienceMin: op.experienceMin,
      experienceMax: op.experienceMax,
      experienceRange: `${op.experienceMin} - ${op.experienceMax || "Any"} yrs`,
      status: op.status,
      postedDate: op.postedDate,
      profilesCount: op._count.hiringProfiles,
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error: any) {
    console.error("[Hiring Manager Controller] Error fetching openings:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch manager openings",
    });
  }
}

/**
 * 2. Fetch Profiles for a Specific Opening
 * GET /api/v1/hiring-manager/openings/:id/profiles
 * Must include: recommendation badge, score, confidence, explanation, latency.
 */
export async function getOpeningProfiles(req: Request, res: Response) {
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

    // Mandatory RBAC & Tenant Verification: opening.hiringManagerId === loggedInUser.id
    assertTenantOwnership(tenantId, opening.tenantId, "Opening");
    assertHiringManagerOwnership(userId, opening.hiringManagerId);

    const profiles = await prisma.hiringProfile.findMany({
      where: {
        openingId: id,
        isDeleted: false,
      },
      orderBy: { submittedAt: "desc" },
    });

    const formattedProfiles = profiles.map((p) => {
      // Determine badge color category
      let badge: "RECOMMENDED" | "BORDERLINE" | "NOT_RECOMMENDED" = "BORDERLINE";
      if (p.recommended === true || (p.recommendationScore !== null && p.recommendationScore >= 0.75)) {
        badge = "RECOMMENDED";
      } else if (p.recommended === false || (p.recommendationScore !== null && p.recommendationScore < 0.5)) {
        badge = "NOT_RECOMMENDED";
      }

      return {
        id: p.id,
        openingId: p.openingId,
        fileName: p.fileName || p.s3Key.split("/").pop(),
        s3Key: p.s3Key,
        uploadedBy: p.uploadedBy,
        submittedAt: p.submittedAt,
        status: p.status,
        shortlistedBy: p.shortlistedBy,
        shortlistedAt: p.shortlistedAt,
        rejectedBy: p.rejectedBy,
        rejectedAt: p.rejectedAt,
        // AI Recommendation Fields
        recommendationBadge: badge,
        recommended: p.recommended,
        score: p.recommendationScore !== null ? Number((p.recommendationScore * 100).toFixed(0)) : null,
        rawScore: p.recommendationScore,
        confidence: p.recommendationConfidence !== null ? Number((p.recommendationConfidence * 100).toFixed(0)) : null,
        rawConfidence: p.recommendationConfidence,
        explanation: p.recommendationReason || "Pending AI evaluation",
        latencyMs: p.recommendationLatencyMs,
        recommendedAt: p.recommendedAt,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        opening,
        profiles: formattedProfiles,
      },
    });
  } catch (error: any) {
    console.error("[Hiring Manager Controller] Error fetching profiles:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch opening profiles",
    });
  }
}

/**
 * 3. Shortlist a Candidate Profile
 * POST /api/v1/hiring-manager/profiles/:id/shortlist
 */
export async function shortlistProfile(req: Request, res: Response) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const userId = getUserIdFromRequest(req);
    const idParam = req.params.profileId || req.params.id;
    const profileId = parseInt(idParam, 10);

    if (isNaN(profileId)) {
      return res.status(400).json({ success: false, message: "Invalid profile ID" });
    }

    const profile = await prisma.hiringProfile.findUnique({
      where: { id: profileId },
      include: { opening: true },
    });

    if (!profile || !profile.opening) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    // Enforce Ownership: only assigned hiring manager can shortlist
    assertTenantOwnership(tenantId, profile.opening.tenantId, "Opening");
    assertHiringManagerOwnership(userId, profile.opening.hiringManagerId);

    const updated = await prisma.hiringProfile.update({
      where: { id: profileId },
      data: {
        status: "SHORTLISTED",
        shortlistedBy: userId,
        shortlistedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Candidate profile shortlisted successfully",
      data: updated,
    });
  } catch (error: any) {
    console.error("[Hiring Manager Controller] Error shortlisting candidate:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to shortlist candidate",
    });
  }
}

/**
 * 4. Reject a Candidate Profile
 * POST /api/v1/hiring-manager/profiles/:id/reject
 */
export async function rejectProfile(req: Request, res: Response) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const userId = getUserIdFromRequest(req);
    const idParam = req.params.profileId || req.params.id;
    const profileId = parseInt(idParam, 10);

    if (isNaN(profileId)) {
      return res.status(400).json({ success: false, message: "Invalid profile ID" });
    }

    const profile = await prisma.hiringProfile.findUnique({
      where: { id: profileId },
      include: { opening: true },
    });

    if (!profile || !profile.opening) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    // Enforce Ownership: only assigned hiring manager can reject
    assertTenantOwnership(tenantId, profile.opening.tenantId, "Opening");
    assertHiringManagerOwnership(userId, profile.opening.hiringManagerId);

    const updated = await prisma.hiringProfile.update({
      where: { id: profileId },
      data: {
        status: "REJECTED",
        rejectedBy: userId,
        rejectedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Candidate profile rejected successfully",
      data: updated,
    });
  } catch (error: any) {
    console.error("[Hiring Manager Controller] Error rejecting candidate:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to reject candidate",
    });
  }
}

/**
 * 5. Secure File Preview for Candidate Resume
 * GET /api/v1/hiring-manager/profiles/:id/preview
 */
export async function getProfilePreviewUrl(req: Request, res: Response) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const userId = getUserIdFromRequest(req);
    const idParam = req.params.profileId || req.params.id;
    const profileId = parseInt(idParam, 10);

    if (isNaN(profileId)) {
      return res.status(400).json({ success: false, message: "Invalid profile ID" });
    }

    const profile = await prisma.hiringProfile.findUnique({
      where: { id: profileId },
      include: { opening: true },
    });

    if (!profile || !profile.opening) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    assertTenantOwnership(tenantId, profile.opening.tenantId, "Opening");
    assertHiringManagerOwnership(userId, profile.opening.hiringManagerId);

    const storage = createStorageService();
    const previewUrl = await storage.getObjectURL(profile.s3Key);

    return res.status(200).json({
      success: true,
      data: {
        previewUrl,
        fileName: profile.fileName,
      },
    });
  } catch (error: any) {
    console.error("[Hiring Manager Controller] Error generating preview URL:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to generate preview URL",
    });
  }
}
