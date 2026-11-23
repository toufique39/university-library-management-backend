
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { requireAuth, requireRole } from "./middleware/auth.middleware.js";
import bookRoutes from "./routes/books.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import { ensureLibraryIndexes } from "./config/indexes.js";
import borrowRoutes from "./routes/borrow.routes.js";
dotenv.config();
import dashboardRoutes from "./routes/dashboard.routes.js";

const app = express();
const PORT = 5000;


//cors
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);


// Better Auth
app.all("/api/auth/*splat", toNodeHandler(auth));


//middleware 
app.use(express.json());
app.use("/api/categories", categoryRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/borrow", borrowRoutes);
app.use("/api/dashboard", dashboardRoutes);



// Health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "University Library API is running!",
  });
});

// Protected route - Any authenticated user
app.get("/api/protected/me", requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Authenticated user information",
    user: req.user,
  });
});

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


// Health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "University Library API is running!",
  });
});

// Database health check
app.get("/api/health/db", async (req, res) => {
  try {
    const db = await connectDB();

    await db.command({ ping: 1 });

    res.status(200).json({
      success: true,
      message: "Database connected successfully!",
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "Database connection failed",
    });
  }
});




// Start server
async function startServer() {
  try {
    const db = await connectDB();

    await db.collection("books").createIndex(
      { isbn: 1 },
      { unique: true }
    );

     // Borrowing system indexes
    await ensureLibraryIndexes(db);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
