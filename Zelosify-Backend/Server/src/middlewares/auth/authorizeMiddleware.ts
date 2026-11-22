import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../../types/typeIndex.js";
import { formatPublicKey } from "../../utils/jwt/formatPubKey.js";
import { isValidRole } from "../../utils/RBAC/isValidRole.js";

const publicKey = formatPublicKey(process.env.KEYCLOAK_RS256_SIG);

export function authorizeRole(requiredrole: string | string[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const token =
      req.headers.authorization?.split(" ")[1] || req.cookies.access_token;

    if (!token) {
      res.status(401).json({ message: "Missing token" });
      return;
    }

    const rolesToCheck = Array.isArray(requiredrole) ? requiredrole : [requiredrole];

    // Validate the provided role(s)
    for (const role of rolesToCheck) {
      if (!isValidRole(role)) {
        res.status(400).json({ message: `Invalid role provided: ${role}` });
        return;
      }
    }

    // Validate public key
    if (!publicKey) {
      res.status(500).json({ message: "Public key not configured" });
      return;
    }

    jwt.verify(
      token,
      publicKey,
      { algorithms: ["RS256"] },
      async (err, decoded) => {
        if (err || typeof decoded !== "object") {
          return res.status(401).json({
            message: "Token verification failed",
            error: err?.message,
          });
        }

        const tokenRoles: string[] = (decoded as any).realm_access?.roles || [];
        const userDbRole = req.user?.role;

        const hasRole = rolesToCheck.some(
          (role) => tokenRoles.includes(role) || userDbRole === role
        );

        if (!hasRole) {
          return res.status(403).json({
            message: `Access Denied: User does not have required role(s): ${rolesToCheck.join(", ")}`,
          });
        }
        console.log("Authorize Role Middleware Passed ✅ : ", req.user || decoded);
        next();
      }
    );
  };
}
