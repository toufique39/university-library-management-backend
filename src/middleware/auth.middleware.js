
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";

export const requireAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please login first.",
      });
    }

    // Attach authenticated user and session
    req.user = session.user;
    req.session = session.session;

    next();
  } catch (error) {
    console.error("Authentication Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify authentication.",
    });
  }
};

// Check user role
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to access this resource.",
      });
    }

    next();
  };
};
