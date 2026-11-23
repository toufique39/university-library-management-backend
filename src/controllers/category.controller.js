
import { ObjectId } from "mongodb";
import { connectDB, client } from "../config/db.js";

const getCategoriesCollection = async () => {
  const db = await connectDB();
  return db.collection("categories");
};

const isValidId = (id) =>
  /^[0-9a-fA-F]{24}$/.test(id);

const createSlug = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const handleError = (res, error) => {
  console.error("Category API Error:", error);

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A category with this name already exists.",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
};

// GET ALL CATEGORIES
export const getAllCategories = async (req, res) => {
  try {
    const collection = await getCategoriesCollection();

    const categories = await collection
      .find({})
      .sort({ name: 1 })
      .toArray();

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// GET SINGLE CATEGORY
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID.",
      });
    }

    const collection = await getCategoriesCollection();

    const category = await collection.findOne({
      _id: new ObjectId(id),
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    handleError(res, error);
  }
};


// CREATE CATEGORY
export const createCategory = async (req, res) => {
  try {
    const { name, description = "" } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 80 ||
      typeof description !== "string" ||
      description.length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid category name and description are required.",
      });
    }

    const cleanName = name.trim();
    const slug = createSlug(cleanName);

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Invalid category name.",
      });
    }

    const collection = await getCategoriesCollection();

    const category = {
      name: cleanName,
      slug,
      description: description.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(category);

    res.status(201).json({
      success: true,
      message: "Category created successfully.",
      data: {
        _id: result.insertedId,
        ...category,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// UPDATE CATEGORY
export const updateCategory = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid category ID.",
    });
  }

  const { name, description } = req.body;

  if (name === undefined && description === undefined) {
    return res.status(400).json({
      success: false,
      message: "No fields provided for update.",
    });
  }

  if (
    name !== undefined &&
    (typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 80)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid category name.",
    });
  }

  if (
    description !== undefined &&
    (typeof description !== "string" || description.length > 500)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid category description.",
    });
  }

  const session = client.startSession();

  try {
    const db = await connectDB();
    const categories = db.collection("categories");
    const books = db.collection("books");

    let updatedCategory = null;
    let categoryNotFound = false;

    await session.withTransaction(async () => {
      const existing = await categories.findOne(
        { _id: new ObjectId(id) },
        { session }
      );

      if (!existing) {
        categoryNotFound = true;
        return;
      }

      const updates = {
        updatedAt: new Date(),
      };

      if (name !== undefined) {
        const cleanName = name.trim();
        const slug = createSlug(cleanName);

        if (!slug) {
          throw new Error("Invalid category name.");
        }

        updates.name = cleanName;
        updates.slug = slug;

        // Update all existing books using this category.
        if (cleanName !== existing.name) {
          await books.updateMany(
            { category: existing.name },
            {
              $set: {
                category: cleanName,
                updatedAt: new Date(),
              },
            },
            { session }
          );
        }
      }

      if (description !== undefined) {
        updates.description = description.trim();
      }

      await categories.updateOne(
        { _id: new ObjectId(id) },
        { $set: updates },
        { session }
      );

      updatedCategory = await categories.findOne(
        { _id: new ObjectId(id) },
        { session }
      );
    });

    if (categoryNotFound) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Category updated successfully.",
      data: updatedCategory,
    });
  } catch (error) {
    if (error.message === "Invalid category name.") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    handleError(res, error);
  } finally {
    await session.endSession();
  }
};

// DELETE CATEGORY
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID.",
      });
    }

    const db = await connectDB();

    const categories = db.collection("categories");
    const books = db.collection("books");

    const category = await categories.findOne({
      _id: new ObjectId(id),
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    const bookCount = await books.countDocuments({
      category: category.name,
    });

    if (bookCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete this category. ${bookCount} book(s) are using it.`,
      });
    }

    await categories.deleteOne({
      _id: new ObjectId(id),
    });

    res.status(200).json({
      success: true,
      message: "Category deleted successfully.",
    });
  } catch (error) {
    handleError(res, error);
  }
};
