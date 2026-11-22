import { describe, it, expect } from "vitest";
import {
  getTenantIdFromRequest,
  getUserIdFromRequest,
  assertTenantOwnership,
  assertHiringManagerOwnership,
  assertVendorProfileOwnership,
  sanitizeProfileForVendor,
  AuthorizationError,
} from "../../../src/utils/RBAC/tenantOwnership.js";
import { isValidRole } from "../../../src/utils/RBAC/isValidRole.js";
import { sanitizeFilename } from "../../../src/helpers/vendorRequestValidation.js";

describe("Phase 2: RBAC & Tenant Isolation Unit Tests", () => {
  const tenantA = "tenant-uuid-1111";
  const tenantB = "tenant-uuid-2222";
  const managerUser = "manager-uuid-3333";
  const otherUser = "other-uuid-4444";
  const vendorUser = "vendor-uuid-5555";
  const otherVendor = "vendor-uuid-6666";

  describe("Role Validation (isValidRole)", () => {
    it("should accept valid system roles including IT_VENDOR and HIRING_MANAGER", () => {
      expect(isValidRole("IT_VENDOR")).toBe(true);
      expect(isValidRole("HIRING_MANAGER")).toBe(true);
      expect(isValidRole("ADMIN")).toBe(true);
      expect(isValidRole("BUSINESS_USER")).toBe(true);
    });

    it("should reject unauthorized or malicious roles", () => {
      expect(isValidRole("SUPER_ADMIN")).toBe(false);
      expect(isValidRole("HACKER")).toBe(false);
      expect(isValidRole("")).toBe(false);
    });
  });

  describe("Request Context Extraction", () => {
    it("should extract tenantId correctly from nested tenant object", () => {
      const req = {
        user: { id: "u1", tenant: { tenantId: tenantA } },
      } as any;
      expect(getTenantIdFromRequest(req)).toBe(tenantA);
    });

    it("should extract tenantId directly if placed on user object", () => {
      const req = {
        user: { id: "u1", tenantId: tenantA },
      } as any;
      expect(getTenantIdFromRequest(req)).toBe(tenantA);
    });

    it("should throw AuthorizationError if tenantId is missing", () => {
      const req = { user: { id: "u1" } } as any;
      expect(() => getTenantIdFromRequest(req)).toThrow(AuthorizationError);
    });

    it("should extract userId correctly", () => {
      const req = { user: { id: managerUser } } as any;
      expect(getUserIdFromRequest(req)).toBe(managerUser);
    });

    it("should throw AuthorizationError if user context is missing", () => {
      const req = {} as any;
      expect(() => getUserIdFromRequest(req)).toThrow(AuthorizationError);
    });
  });

  describe("Tenant Isolation Enforcement (assertTenantOwnership)", () => {
    it("should allow access when caller and resource tenant match", () => {
      expect(() => assertTenantOwnership(tenantA, tenantA)).not.toThrow();
    });

    it("should strictly reject cross-tenant access with 403 Forbidden", () => {
      expect(() => assertTenantOwnership(tenantA, tenantB, "Opening")).toThrow(
        AuthorizationError
      );
      try {
        assertTenantOwnership(tenantA, tenantB, "Opening");
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toContain("Cross-tenant access violation");
      }
    });
  });

  describe("Hiring Manager Ownership Enforcement (assertHiringManagerOwnership)", () => {
    it("should allow manager when opening.hiringManagerId === loggedInUser.id", () => {
      expect(() =>
        assertHiringManagerOwnership(managerUser, managerUser)
      ).not.toThrow();
    });

    it("should reject access when user does not own the opening", () => {
      expect(() =>
        assertHiringManagerOwnership(otherUser, managerUser)
      ).toThrow(AuthorizationError);
      try {
        assertHiringManagerOwnership(otherUser, managerUser);
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });
  });

  describe("Vendor Profile Ownership Enforcement (assertVendorProfileOwnership)", () => {
    it("should allow vendor when profile.uploadedBy === loggedInUser.id", () => {
      expect(() =>
        assertVendorProfileOwnership(vendorUser, vendorUser)
      ).not.toThrow();
    });

    it("should reject vendor when attempting to view/modify other vendor profile", () => {
      expect(() =>
        assertVendorProfileOwnership(otherVendor, vendorUser)
      ).toThrow(AuthorizationError);
      try {
        assertVendorProfileOwnership(otherVendor, vendorUser);
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });
  });

  describe("Vendor Profile Sanitization (sanitizeProfileForVendor)", () => {
    it("should completely strip all AI recommendation fields for IT Vendor persona", () => {
      const rawProfile = {
        id: 1,
        openingId: "op-1",
        s3Key: "tenant/op/resume.pdf",
        fileName: "resume.pdf",
        uploadedBy: vendorUser,
        status: "SUBMITTED",
        // Sensitive AI fields that MUST NOT leak to IT Vendor
        recommended: true,
        recommendationScore: 0.88,
        recommendationReason: "Candidate is a perfect match",
        recommendationLatencyMs: 950,
        recommendationVersion: "v1.0",
        recommendationConfidence: 0.94,
        recommendedAt: new Date(),
        reasoningMetadata: { toolsUsed: ["parseResume", "computeDeterministicScore"] },
        tokenUsage: { totalTokens: 450 },
        isDeleted: false,
      };

      const sanitized = sanitizeProfileForVendor(rawProfile);

      expect(sanitized.id).toBe(1);
      expect(sanitized.fileName).toBe("resume.pdf");
      expect(sanitized.status).toBe("SUBMITTED");
      expect(sanitized.uploadedBy).toBe(vendorUser);

      // Verify AI fields are completely absent
      expect((sanitized as any).recommended).toBeUndefined();
      expect((sanitized as any).recommendationScore).toBeUndefined();
      expect((sanitized as any).recommendationReason).toBeUndefined();
      expect((sanitized as any).recommendationLatencyMs).toBeUndefined();
      expect((sanitized as any).recommendationConfidence).toBeUndefined();
      expect((sanitized as any).reasoningMetadata).toBeUndefined();
      expect((sanitized as any).tokenUsage).toBeUndefined();
    });
  });

  describe("File Sanitization & S3 Key Structure", () => {
    it("should sanitize filenames with special characters", () => {
      expect(sanitizeFilename("My Resume (2026)!.pdf")).toBe("my_resume_2026_.pdf");
      expect(sanitizeFilename("Senior Engineer - PPTX Présentation.pptx")).toBe(
        "senior_engineer_-_pptx_pr_sentation.pptx"
      );
    });
  });
});
