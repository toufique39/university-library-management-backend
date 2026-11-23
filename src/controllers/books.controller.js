
import { ObjectId } from "mongodb";
import { connectDB } from "../config/db.js";

// Get books collection
const getBooksCollection = async () => {
  const db = await connectDB();
  return db.collection("books");
};

// Validate MongoDB ObjectId
const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

// Normalize ISBN
const normalizeIsbn = (isbn) =>
  isbn.trim().replace(/[\s-]/g, "").toUpperCase();

// Handle database errors
const handleError = (res, error) => {
  console.error("Book API Error:", error);

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A book with this ISBN already exists.",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
};

// Escape special regex characters
const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET ALL BOOKS
export const getAllBooks = async (req, res) => {
  try {
    const collection = await getBooksCollection();

    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    const search = String(req.query.q || "").trim();
    const category = String(req.query.category || "").trim();
    const availability = String(req.query.availability || "all");

    if (search.length > 100 || category.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search or category value is too long.",
      });
    }

    if (!["all", "available", "unavailable"].includes(availability)) {
      return res.status(400).json({
        success: false,
        message: "Invalid availability filter.",
      });
    }

    const filter = {};

// Search by title, author, ISBN or publisher
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");

      filter.$or = [
        { title: searchRegex },
        { author: searchRegex },
        { isbn: searchRegex },
        { publisher: searchRegex },
      ];
    }

    // Exact category filter
    if (category) {
      filter.category = category;
    }

    // Availability filter
    if (availability === "available") {
      filter.availableCopies = { $gt: 0 };
    } else if (availability === "unavailable") {
      filter.availableCopies = 0;
    }



    const skip = (page - 1) * limit;

   
    const [books, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),

      collection.countDocuments(filter),
    ]);

      res.status(200).json({
      success: true,
      message: "Books retrieved successfully.",
      data: books,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        search,
        category,
        availability,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};


// GET ALL UNIQUE BOOK CATEGORIES
export const getBookCategories = async (req, res) => {
  try {
    const collection = await getBooksCollection();

    const categories = await collection.distinct("category");

    res.status(200).json({
      success: true,
      data: categories.filter(Boolean).sort(),
    });
  } catch (error) {
    handleError(res, error);
  }
};

// GET SINGLE BOOK
export const getBookById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    const collection = await getBooksCollection();

    const book = await collection.findOne({
      _id: new ObjectId(id),
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: book,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// CREATE BOOK
export const createBook = async (req, res) => {
  try {
    const {
      title,
      author,
      isbn,
      category,
      description = "",
      publisher = "",
      publishedYear = null,
      totalCopies,
      shelfLocation = "",
      coverImage = "",
    } = req.body;

    if (
      typeof title !== "string" ||
      typeof author !== "string" ||
      typeof isbn !== "string" ||
      typeof category !== "string" ||
      !title.trim() ||
      !author.trim() ||
      !isbn.trim() ||
      !category.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Title, author, ISBN and category are required.",
      });
    }

    const copies = Number(totalCopies);

    if (!Number.isInteger(copies) || copies < 1) {
      return res.status(400).json({
        success: false,
        message: "Total copies must be a positive integer.",
      });
    }

    const year =
      publishedYear === null || publishedYear === ""
        ? null
        : Number(publishedYear);

    if (
      year !== null &&
      (!Number.isInteger(year) || year < 0 || year > 9999)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid published year.",
      });
    }

    const optionalFields = [
      description,
      publisher,
      shelfLocation,
      coverImage,
    ];

    if (!optionalFields.every((value) => typeof value === "string")) {
      return res.status(400).json({
        success: false,
        message: "Optional text fields must be strings.",
      });
    }

    const book = {
      title: title.trim(),
      author: author.trim(),
      isbn: normalizeIsbn(isbn),
      category: category.trim(),
      description: description.trim(),
      publisher: publisher.trim(),
      publishedYear: year,
      totalCopies: copies,
      availableCopies: copies,
      shelfLocation: shelfLocation.trim(),
      coverImage: coverImage.trim(),
      createdBy: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
     
    const db = await connectDB();
    const collection = db.collection("books");

    const categoryExists = await db.collection("categories").findOne({
      name: category.trim(),
    });

    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid book category.",
      });
    }

    const result = await collection.insertOne(book);

    res.status(201).json({
      success: true,
      message: "Book created successfully.",
      data: {
        _id: result.insertedId,
        ...book,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// UPDATE BOOK
export const updateBook = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }
    
    const collection = await getBooksCollection();

    const existingBook = await collection.findOne({
      _id: new ObjectId(id),
    });

    if (!existingBook) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    const allowedFields = [
      "title",
      "author",
      "isbn",
      "category",
      "description",
      "publisher",
      "shelfLocation",
      "coverImage",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (
          typeof req.body[field] !== "string" ||
          ((["title", "author", "isbn", "category"].includes(field)) &&
            !req.body[field].trim())
        ) {
          return res.status(400).json({
            success: false,
            message: `Invalid value for ${field}.`,
          });
        }

        updates[field] =
          field === "isbn"
            ? normalizeIsbn(req.body[field])
            : req.body[field].trim();
      }
    }

    if (req.body.publishedYear !== undefined) {
      const year =
        req.body.publishedYear === null ||
        req.body.publishedYear === ""
          ? null
          : Number(req.body.publishedYear);

      if (
        year !== null &&
        (!Number.isInteger(year) || year < 0 || year > 9999)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid published year.",
        });
      }

      updates.publishedYear = year;
    }

    if (req.body.totalCopies !== undefined) {
      const newTotal = Number(req.body.totalCopies);

      if (!Number.isInteger(newTotal) || newTotal < 1) {
        return res.status(400).json({
          success: false,
          message: "Total copies must be a positive integer.",
        });
      }

      // Preserve already borrowed copies
      const borrowedCopies =
        existingBook.totalCopies - existingBook.availableCopies;

      if (newTotal < borrowedCopies) {
        return res.status(400).json({
          success: false,
          message: "Total copies cannot be less than borrowed copies.",
        });
      }

      updates.totalCopies = newTotal;
      updates.availableCopies = newTotal - borrowedCopies;
    }

    if (updates.category) {
      const db = await connectDB();

      const categoryExists = await db.collection("categories").findOne({
        name: updates.category,
      });

      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Please select a valid book category.",
        });
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update.",
      });
    }

    updates.updatedAt = new Date();

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    const updatedBook = await collection.findOne({
      _id: new ObjectId(id),
    });

    res.status(200).json({
      success: true,
      message: "Book updated successfully.",
      data: updatedBook,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE BOOK
export const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    const db = await connectDB();
    const collection = db.collection("books");
    const bookId = new ObjectId(id);

    const [activeBorrows, pendingRequests] = await Promise.all([
      db.collection("borrowRecords").countDocuments({
        bookId,
        status: "issued",
      }),
      db.collection("borrowRequests").countDocuments({
        bookId,
        status: "pending",
      }),
    ]);

    if (activeBorrows > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete this book while copies are still borrowed.",
      });
    }

    if (pendingRequests > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete this book while borrow requests are pending.",
      });
    }

    const result = await collection.deleteOne({
      _id: bookId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Book deleted successfully.",
    });
  } catch (error) {
    handleError(res, error);
  }
};
