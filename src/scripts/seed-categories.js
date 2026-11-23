
import "dotenv/config";
import { connectDB, client } from "../config/db.js";

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function seedCategories() {
  try {
    const db = await connectDB();

    const booksCollection = db.collection("books");
    const categoriesCollection = db.collection("categories");

    await categoriesCollection.createIndex(
      { slug: 1 },
      { unique: true }
    );

    const existingCategories = await booksCollection.distinct("category");

    for (const name of existingCategories) {
      if (typeof name !== "string" || !name.trim()) continue;

      const cleanName = name.trim();
      const slug = slugify(cleanName);

      if (!slug) continue;

      await categoriesCollection.updateOne(
        { slug },
        {
          $setOnInsert: {
            name: cleanName,
            slug,
            description: "",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    console.log("Existing book categories synchronized successfully!");
  } catch (error) {
    console.error("Category migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

seedCategories();
