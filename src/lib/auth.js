
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";

import {
  connectDB,
  client,
} from "../config/db.js";

const db = await connectDB();

const trustedOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:10000"]
    : []),
].filter(Boolean);

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
  }),

  baseURL: process.env.BETTER_AUTH_URL,

  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins,

  emailAndPassword: {
    enabled: true,
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "member",
        input: false,
      },
    },
  },

  advanced: {
    useSecureCookies: true,
  },
});
