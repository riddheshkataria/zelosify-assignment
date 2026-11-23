import { Router, type RequestHandler } from "express";
import { authenticateUser } from "../../middlewares/auth/authenticateMiddleware.js";
import { authorizeRole } from "../../middlewares/auth/authorizeMiddleware.js";
import {
  getVendorOpenings,
  getVendorOpeningDetails,
  presignVendorUploadUrls,
  submitVendorProfiles,
  softDeleteVendorProfile,
} from "../../controllers/vendor/vendorOpeningsController.js";

const router = Router();

// Apply Authentication and IT_VENDOR Role Authorization across all vendor openings routes
router.use(authenticateUser as RequestHandler);
router.use(authorizeRole("IT_VENDOR") as RequestHandler);

// 1. Fetch Openings
router.get("/", getVendorOpenings as unknown as RequestHandler);

// 2. Fetch Opening Details
router.get("/:id", getVendorOpeningDetails as unknown as RequestHandler);

// 3. Presign Upload URLs (both /:id/presign-upload and /:id/profiles/presign)
router.post("/:id/presign-upload", presignVendorUploadUrls as unknown as RequestHandler);
router.post("/:id/profiles/presign", presignVendorUploadUrls as unknown as RequestHandler);

// 4. Submit Profiles (both /:id/submit-profiles and /:id/profiles/upload)
router.post("/:id/submit-profiles", submitVendorProfiles as unknown as RequestHandler);
router.post("/:id/profiles/upload", submitVendorProfiles as unknown as RequestHandler);

// 5. Soft Delete Profile (both DELETE and PATCH supported)
router.delete("/:openingId/profiles/:id", softDeleteVendorProfile as unknown as RequestHandler);
router.delete("/:openingId/profiles/:profileId", softDeleteVendorProfile as unknown as RequestHandler);
router.delete("/profiles/:id", softDeleteVendorProfile as unknown as RequestHandler);
router.patch("/profiles/:id/soft-delete", softDeleteVendorProfile as unknown as RequestHandler);

export default router;
