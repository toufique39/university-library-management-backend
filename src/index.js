
import "dotenv/config";

import express from "express";
import cors from "cors";

import { connectDB } from "./config/db.js";
import { ensureLibraryIndexes } from "./config/indexes.js";

import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";

import {
  requireAuth,
  requireRole,
} from "./middleware/auth.middleware.js";

import bookRoutes from "./routes/books.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import borrowRoutes from "./routes/borrow.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

const app = express();

// ========================================
// CORS CONFIGURATION
// ========================================

const allowedOrigins = [
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ========================================
// DATABASE INITIALIZATION
// ========================================

let initializationPromise;

async function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const db = await connectDB();

      await db.collection("books").createIndex(
        { isbn: 1 },
        { unique: true }
      );

      // Migrate old customer roles
      await db.collection("user").updateMany(
        {
          $or: [
            { role: "customer" },
            { role: { $exists: false } },
          ],
        },
        {
          $set: { role: "member" },
        }
      );

      // Borrowing system indexes
      await ensureLibraryIndexes(db);

      console.log("Database initialization completed.");
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

// Initialize DB before handling API requests.
// This middleware does not consume the request body.
app.use(async (req, res, next) => {
  try {
    await initializeDatabase();
    next();
  } catch (error) {
    console.error("Database initialization failed:", error);

    res.status(503).json({
      success: false,
      message: "Database initialization failed.",
    });
  }
});

// ========================================
// BETTER AUTH
// ========================================

// Express 5 wildcard syntax.
// Keep Better Auth before express.json().
app.all("/api/auth/*splat", toNodeHandler(auth));

// ========================================
// BODY PARSER
// ========================================

app.use(express.json());

// ========================================
// API ROUTES
// ========================================

app.use("/api/categories", categoryRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/borrow", borrowRoutes);
app.use("/api/dashboard", dashboardRoutes);

// ========================================
// HEALTH CHECK
// ========================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "University Library API is running!",
    environment: process.env.NODE_ENV,
  });
});

// ========================================
// PROTECTED ROUTES
// ========================================

app.get(
  "/api/protected/me",
  requireAuth,
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Authenticated user information",
      user: req.user,
    });
  }
);

// Admin only
app.get(
  "/api/admin/test",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome Admin!",
    });
  }
);

// Admin and Librarian
app.get(
  "/api/librarian/test",
  requireAuth,
  requireRole("admin", "librarian"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome Librarian!",
    });
  }
);

// ========================================
// DATABASE HEALTH CHECK
// ========================================

app.get("/api/health/db", async (req, res) => {
  try {
    const db = await connectDB();

    await db.command({ ping: 1 });

    res.status(200).json({
      success: true,
      message: "Database connected successfully!",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      success: false,
      message: "Database connection failed.",
    });
  }
});

// ========================================
// ERROR HANDLER
// ========================================

app.use((error, req, res, next) => {
  console.error("API Error:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

// ========================================
// LOCAL DEVELOPMENT SERVER
// ========================================

if (process.env.NODE_ENV !== "production") {
  const PORT =5000;

  app.listen(PORT, () => {
    console.log(`Local server running on port ${PORT}`);
  });
}

// ========================================
// VERCEL SERVERLESS EXPORT
// ========================================

export default app;
