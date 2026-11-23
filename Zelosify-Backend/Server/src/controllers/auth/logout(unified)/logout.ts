import { Response } from "express";
import { AuthenticatedRequest } from "../../../types/common.js";
import asyncHandler from "../../../utils/handler/asyncHandler.js";
import { getAdminToken } from "../../../utils/keycloak/getAdminToken.js";
import { getClientSecret } from "../../../config/keycloak/keycloak.js";
import axios from "axios";

export const logout = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Retrieve refresh token from cookies or header.
      const refreshToken =
        req.cookies.refresh_token || req.headers.authorization?.split(" ")[1];
      if (!refreshToken) {
        console.log("⚠️ No refresh token found, already logged out.");
        res
          .status(400)
          .json({ message: "No refresh token found, already logged out" });
        return;
      }
      // Assuming that authentication middleware attaches req.user:
      // Use type assertion to access req.user
      const user = (req as any).user;
      console.log("Logging out user:", user);

      // Check if this is a Keycloak user or OAuth user.
      if (user && user.provider === "KEYCLOAK") {
        const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || (await getClientSecret(await getAdminToken()));
        if (clientSecret) {
          try {
            await axios.post(
              `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/logout`,
              new URLSearchParams({
                client_id: process.env.KEYCLOAK_CLIENT_ID!,
                client_secret: clientSecret,
                refresh_token: refreshToken,
              }),
              {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                timeout: 2000,
              }
            );
            console.log("Keycloak session invalidated for user.");
          } catch (error: any) {
            console.warn("Keycloak logout notification error (session cleared locally):", error.message);
          }
        }
      }

      // Clear cookies securely and reliably across environments
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
      };
      res.clearCookie("access_token", cookieOptions);
      res.clearCookie("refresh_token", cookieOptions);
      res.clearCookie("role", { ...cookieOptions, httpOnly: false });
      console.log("Cookies cleared successfully.");

      res.status(200).json({ message: "Logged out successfully" });
      return;
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Error logging out" });
      return;
    }
  }
);
