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

// 3. Shortlist a candidate profile
router.post("/profiles/:id/shortlist", shortlistProfile as unknown as RequestHandler);

// 4. Reject a candidate profile
router.post("/profiles/:id/reject", rejectProfile as unknown as RequestHandler);

// 5. Secure file preview URL
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
