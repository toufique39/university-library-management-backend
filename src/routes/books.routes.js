
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

// Public catalog reads
router.get("/", getAllBooks);
router.get("/categories", getBookCategories);
router.get("/:id", getBookById);

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
