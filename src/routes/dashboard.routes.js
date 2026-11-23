
import express from "express";

import {
  getAdminDashboard,
  getMemberDashboard,
} from "../controllers/dashboard.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Admin Dashboard
router.get(
  "/admin",
  requireAuth,
  requireRole("admin", "librarian"),
  getAdminDashboard
);

// Member Dashboard
router.get(
  "/member",
  requireAuth,
  requireRole("member"),
  getMemberDashboard
);

export default router;
