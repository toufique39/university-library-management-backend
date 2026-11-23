
import express from "express";

import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Read
router.get("/", requireAuth, getAllCategories);
router.get("/:id", requireAuth, getCategoryById);

// Write
router.post(
  "/",
  requireAuth,
  requireRole("admin", "librarian"),
  createCategory
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("admin", "librarian"),
  updateCategory
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("admin", "librarian"),
  deleteCategory
);

export default router;
