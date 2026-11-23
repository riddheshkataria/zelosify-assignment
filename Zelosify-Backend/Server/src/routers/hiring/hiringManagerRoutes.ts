import { Router, type RequestHandler } from "express";
import { authenticateUser } from "../../middlewares/auth/authenticateMiddleware.js";
import { authorizeRole } from "../../middlewares/auth/authorizeMiddleware.js";
import {
  getManagerOpenings,
  getOpeningProfiles,
  shortlistProfile,
  rejectProfile,
  getProfilePreviewUrl,
} from "../../controllers/hiring/hiringManagerController.js";
import { fetchData } from "../../controllers/controllers.js";

const router = Router();

// Apply Authentication and HIRING_MANAGER Role Authorization across all routes
router.use(authenticateUser as RequestHandler);
router.use(authorizeRole("HIRING_MANAGER") as RequestHandler);

// 1. Fetch Openings assigned to logged-in manager
router.get("/openings", getManagerOpenings as unknown as RequestHandler);

// 2. Fetch Profiles for a specific opening
router.get("/openings/:id/profiles", getOpeningProfiles as unknown as RequestHandler);

// 3. Shortlist a candidate profile (both /openings/:openingId/profiles/:profileId/shortlist and /profiles/:id/shortlist)
router.post("/openings/:openingId/profiles/:profileId/shortlist", shortlistProfile as unknown as RequestHandler);
router.post("/profiles/:id/shortlist", shortlistProfile as unknown as RequestHandler);

// 4. Reject a candidate profile (both /openings/:openingId/profiles/:profileId/reject and /profiles/:id/reject)
router.post("/openings/:openingId/profiles/:profileId/reject", rejectProfile as unknown as RequestHandler);
router.post("/profiles/:id/reject", rejectProfile as unknown as RequestHandler);

// 5. Secure file preview URL (both /openings/:openingId/profiles/:profileId/preview and /profiles/:id/preview)
router.get("/openings/:openingId/profiles/:profileId/preview", getProfilePreviewUrl as unknown as RequestHandler);
router.get("/profiles/:id/preview", getProfilePreviewUrl as unknown as RequestHandler);

// Legacy root vacancy check (preserved for backwards compatibility)
router.get("/", (async (req, res, next) => {
  try {
    await fetchData(req as any, res);
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

export default router;
