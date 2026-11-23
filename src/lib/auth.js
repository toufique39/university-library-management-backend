
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { connectDB, client } from "../config/db.js";

const db = await connectDB();

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
  }),

  baseURL: process.env.BETTER_AUTH_URL,

  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins: ["http://localhost:10000",
    "https://pizzahub39.netlify.app",
  ],

  emailAndPassword: {
    enabled: true,
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "member",
        input: true,
        transform: {
          input: (value) =>
            ["member", "librarian"].includes(value) ? value : "member",
        },
      },
    },
  },
});
