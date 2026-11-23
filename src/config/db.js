
import "dotenv/config";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

if (!uri) {
  throw new Error("MONGODB_URI is missing");
}

if (!dbName) {
  throw new Error("MONGODB_DB is missing");
}

const client = new MongoClient(uri);

let clientPromise;

export async function connectDB() {
  if (!clientPromise) {
    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }

  await clientPromise;

  const db = client.db(dbName);

  console.log("MongoDB Connected Successfully!");

  return db;
}

export { client };
