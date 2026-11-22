import express, { type RequestHandler } from "express";
import vendorRequestRoutes from "./vendorRequestRoutes.js";
import vendorOpeningsRoutes from "./vendorOpeningsRoutes.js";
import { authenticateUser } from "../../middlewares/auth/authenticateMiddleware.js";
import { authorizeRole } from "../../middlewares/auth/authorizeMiddleware.js";
import { softDeleteVendorProfile } from "../../controllers/vendor/vendorOpeningsController.js";

const router = express.Router();

/**
 * @route /vendor/requests
 */
router.use("/requests", vendorRequestRoutes);

/**
 * @route /vendor/openings
 */
router.use("/openings", vendorOpeningsRoutes);

/**
 * @route /vendor/profiles/:id/soft-delete
 */
router.patch(
  "/profiles/:id/soft-delete",
  authenticateUser as RequestHandler,
  authorizeRole("IT_VENDOR") as RequestHandler,
  softDeleteVendorProfile as unknown as RequestHandler
);

export default router;
