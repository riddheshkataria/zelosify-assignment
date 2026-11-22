import type { Request } from "express";

export class AuthorizationError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
  }
}

/**
 * Extracts and asserts the tenantId from the authenticated request.
 * Throws 401 if request is unauthenticated, or 403 if tenant is missing.
 */
export function getTenantIdFromRequest(req: Request): string {
  const tenantId = req.user?.tenant?.tenantId || req.user?.tenantId;
  if (!tenantId) {
    throw new AuthorizationError("Tenant context missing from authenticated session", 403);
  }
  return tenantId;
}

/**
 * Extracts the internal user ID from the authenticated request.
 */
export function getUserIdFromRequest(req: Request): string {
  const userId = req.user?.id;
  if (!userId) {
    throw new AuthorizationError("User context missing from authenticated session", 401);
  }
  return userId;
}

/**
 * Asserts that a target resource belongs to the caller's tenant.
 * Failure results in immediate 403 Forbidden.
 */
export function assertTenantOwnership(
  callerTenantId: string,
  resourceTenantId: string,
  resourceName = "Resource"
): void {
  if (!callerTenantId || callerTenantId !== resourceTenantId) {
    throw new AuthorizationError(
      `Cross-tenant access violation: Caller does not have permission to access ${resourceName}`,
      403
    );
  }
}

/**
 * Asserts that an opening belongs to the assigned Hiring Manager.
 * Mandatory requirement: opening.hiringManagerId === loggedInUser.id
 */
export function assertHiringManagerOwnership(
  callerUserId: string,
  openingHiringManagerId: string
): void {
  if (!callerUserId || callerUserId !== openingHiringManagerId) {
    throw new AuthorizationError(
      "Access Denied: Hiring Manager does not have ownership of this opening",
      403
    );
  }
}

/**
 * Asserts that an IT Vendor is only accessing profiles they themselves uploaded.
 * Mandatory requirement: profile.uploadedBy === loggedInUser.id
 */
export function assertVendorProfileOwnership(
  callerUserId: string,
  profileUploadedBy: string
): void {
  if (!callerUserId || callerUserId !== profileUploadedBy) {
    throw new AuthorizationError(
      "Access Denied: IT Vendor can only view and manage candidate profiles they uploaded",
      403
    );
  }
}

/**
 * Sanitizes candidate profile objects for IT_VENDOR persona.
 * IT Vendors are STRICTLY prohibited from seeing AI recommendation scores, reasoning, or confidence.
 */
export function sanitizeProfileForVendor<T extends Record<string, any>>(profile: T): Omit<
  T,
  | "recommended"
  | "recommendationScore"
  | "recommendationReason"
  | "recommendationLatencyMs"
  | "recommendationVersion"
  | "recommendationConfidence"
  | "recommendedAt"
  | "reasoningMetadata"
  | "tokenUsage"
> {
  const {
    recommended,
    recommendationScore,
    recommendationReason,
    recommendationLatencyMs,
    recommendationVersion,
    recommendationConfidence,
    recommendedAt,
    reasoningMetadata,
    tokenUsage,
    ...safeVendorProfile
  } = profile;

  return safeVendorProfile;
}
