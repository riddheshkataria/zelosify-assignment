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

      // Extract metadata if saved in reasoningMetadata or fallback to fileName
      const meta = (p.reasoningMetadata && typeof p.reasoningMetadata === "object" && !Array.isArray(p.reasoningMetadata))
        ? (p.reasoningMetadata as Record<string, any>)
        : {};

      const rawFileName = p.fileName || p.s3Key.split("/").pop() || "Candidate";
      const cleanCandidateName = meta.candidateName || rawFileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_](resume|cv|general|profile|final).*/i, "")
        .replace(/[_-]/g, " ")
        .trim() || `Candidate #${p.id}`;

      const cleanCandidateEmail = meta.candidateEmail || `${cleanCandidateName.toLowerCase().replace(/\s+/g, ".")}@candidate.zelosify.com`;
      const experienceYears = meta.experienceYears ?? opening.experienceMin ?? 3;
      const keySkills = meta.keySkills && Array.isArray(meta.keySkills) && meta.keySkills.length > 0
        ? meta.keySkills
        : ["TypeScript", "Node.js", "React"];

      const scorePct = p.recommendationScore !== null ? Number((p.recommendationScore * 100).toFixed(0)) : null;
      const confPct = p.recommendationConfidence !== null ? Number((p.recommendationConfidence * 100).toFixed(0)) : null;

      return {
        id: p.id,
        openingId: p.openingId,
        fileName: rawFileName,
        s3Key: p.s3Key,
        uploadedBy: p.uploadedBy,
        submittedAt: p.submittedAt,
        status: p.status,
        shortlistedBy: p.shortlistedBy,
        shortlistedAt: p.shortlistedAt,
        rejectedBy: p.rejectedBy,
        rejectedAt: p.rejectedAt,
        // Candidate profile details
        candidateName: cleanCandidateName,
        candidateEmail: cleanCandidateEmail,
        experienceYears,
        keySkills,
        // AI Recommendation Fields (compatible with both property conventions)
        recommendationBadge: badge,
        recommended: p.recommended,
        score: scorePct,
        rawScore: p.recommendationScore,
        confidence: confPct,
        rawConfidence: p.recommendationConfidence,
        explanation: p.recommendationReason || "Pending AI evaluation",
        latencyMs: p.recommendationLatencyMs,
        recommendedAt: p.recommendedAt,
        recommendationScore: p.recommendationScore,
        recommendationConfidence: p.recommendationConfidence,
        recommendationReason: p.recommendationReason || "Pending AI evaluation",
        recommendationLatencyMs: p.recommendationLatencyMs,
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

/**
 * 6. Create a New Contract Opening
 * POST /api/v1/hiring-manager/openings
 */
export async function createOpening(req: Request, res: Response) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const userId = getUserIdFromRequest(req);
    const { title, description, location, contractType, experienceMin, experienceMax } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Opening title is required" });
    }

    const created = await prisma.opening.create({
      data: {
        tenantId,
        hiringManagerId: userId,
        title: title.trim(),
        description: description ? description.trim() : "",
        location: location ? location.trim() : "Remote",
        contractType: contractType || "C2C",
        experienceMin: Number(experienceMin) || 3,
        experienceMax: experienceMax ? Number(experienceMax) : null,
        status: "OPEN",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Contract opening created successfully",
      data: created,
    });
  } catch (error: any) {
    console.error("[Hiring Manager Controller] Error creating opening:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create contract opening",
    });
  }
}

/**
 * 7. Update an Existing Contract Opening (Status, details)
 * PUT/PATCH /api/v1/hiring-manager/openings/:id
 */
export async function updateOpening(req: Request, res: Response) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;
    const { title, description, location, contractType, experienceMin, experienceMax, status } = req.body;

    const opening = await prisma.opening.findUnique({ where: { id } });
    if (!opening) {
      return res.status(404).json({ success: false, message: "Opening not found" });
    }

    assertTenantOwnership(tenantId, opening.tenantId, "Opening");
    assertHiringManagerOwnership(userId, opening.hiringManagerId);

    const dataToUpdate: any = {};
    if (title !== undefined) dataToUpdate.title = title.trim();
    if (description !== undefined) dataToUpdate.description = description.trim();
    if (location !== undefined) dataToUpdate.location = location.trim();
    if (contractType !== undefined) dataToUpdate.contractType = contractType;
    if (experienceMin !== undefined) dataToUpdate.experienceMin = Number(experienceMin);
    if (experienceMax !== undefined) dataToUpdate.experienceMax = Number(experienceMax);
    if (status !== undefined) dataToUpdate.status = status;

    const updated = await prisma.opening.update({
      where: { id },
      data: dataToUpdate,
    });

    return res.status(200).json({
      success: true,
      message: "Contract opening updated successfully",
      data: updated,
    });
  } catch (error: any) {
    console.error("[Hiring Manager Controller] Error updating opening:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update contract opening",
    });
  }
}

/**
 * 8. Fetch All Incoming Candidate Applications Across All Openings
 * GET /api/v1/hiring-manager/applications
 */
export async function getAllManagerApplications(req: Request, res: Response) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const userId = getUserIdFromRequest(req);

    const openings = await prisma.opening.findMany({
      where: { tenantId, hiringManagerId: userId },
      select: { id: true, title: true, contractType: true },
    });

    const openingIds = openings.map((o) => o.id);
    const openingMap = new Map(openings.map((o) => [o.id, o]));

    const profiles = await prisma.hiringProfile.findMany({
      where: { openingId: { in: openingIds }, isDeleted: false },
      orderBy: { submittedAt: "desc" },
    });

    const formatted = profiles.map((p) => {
      const op = openingMap.get(p.openingId);
      const rawFileName = p.fileName || p.s3Key.split("/").pop() || "Candidate";
      const cleanCandidateName = rawFileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_](resume|cv|general|profile|final).*/i, "")
        .replace(/[_-]/g, " ")
        .trim() || `Candidate #${p.id}`;

      return {
        id: p.id,
        openingId: p.openingId,
        openingTitle: op?.title || "Contract Opening",
        contractType: op?.contractType || "Contract",
        fileName: rawFileName,
        candidateName: cleanCandidateName,
        candidateEmail: `${cleanCandidateName.toLowerCase().replace(/\s+/g, ".")}@candidate.zelosify.com`,
        status: p.status,
        submittedAt: p.submittedAt,
        score: p.recommendationScore !== null ? Math.round(p.recommendationScore * 100) : null,
        recommendationScore: p.recommendationScore,
        recommended: p.recommended,
      };
    });

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error: any) {
    console.error("[Hiring Manager Controller] Error fetching applications:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch candidate applications",
    });
  }
}
