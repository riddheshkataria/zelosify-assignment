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

// 3. Presign Upload URLs
router.post("/:id/profiles/presign", presignVendorUploadUrls as unknown as RequestHandler);

// 4. Submit Profiles
router.post("/:id/profiles/upload", submitVendorProfiles as unknown as RequestHandler);

// 5. Soft Delete Profile
router.patch("/profiles/:id/soft-delete", softDeleteVendorProfile as unknown as RequestHandler);

export default router;
