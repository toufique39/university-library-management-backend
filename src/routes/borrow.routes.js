
import express from "express";

import {
  createBorrowRequest,
  getMyBorrowRequests,
  getAllBorrowRequests,
  approveBorrowRequest,
  rejectBorrowRequest,
  getMyBorrowRecords,
  getAllBorrowRecords,
  returnBook,
} from "../controllers/borrow.controller.js";

import {
  requireAuth,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Member routes
router.post(
  "/requests",
  requireAuth,
  requireRole("member"),
  createBorrowRequest
);

router.get(
  "/requests/my",
  requireAuth,
  requireRole("member"),
  getMyBorrowRequests
);

router.get(
  "/records/my",
  requireAuth,
  requireRole("member"),
  getMyBorrowRecords
);

// Admin / Librarian routes
router.get(
  "/requests",
  requireAuth,
  requireRole("admin", "librarian"),
  getAllBorrowRequests
);

router.patch(
  "/requests/:id/approve",
  requireAuth,
  requireRole("admin", "librarian"),
  approveBorrowRequest
);

router.patch(
  "/requests/:id/reject",
  requireAuth,
  requireRole("admin", "librarian"),
  rejectBorrowRequest
);

router.get(
  "/records",
  requireAuth,
  requireRole("admin", "librarian"),
  getAllBorrowRecords
);

router.patch(
  "/records/:id/return",
  requireAuth,
  requireRole("admin", "librarian"),
  returnBook
);

export default router;
