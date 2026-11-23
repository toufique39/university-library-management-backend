
import express from "express";

import {
  getAllBooks,
  getBookById,
  createBook,
  getBookCategories,
  updateBook,
  deleteBook,
} from "../controllers/books.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Read permissions
router.get("/", requireAuth,requireRole("member","admin","librarian"), getAllBooks);
router.get("/categories", requireAuth,requireRole("member","admin","librarian"), getBookCategories);
router.get("/:id", requireAuth,requireRole("member","admin","librarian"), getBookById);

// Write permissions
router.post(
  "/",
  requireAuth,
  requireRole("admin", "librarian"),
  createBook
);

//something update
router.patch(
  "/:id",
  requireAuth,
  requireRole("admin", "librarian"),
  updateBook
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("admin", "librarian"),
  deleteBook
);

export default router;
