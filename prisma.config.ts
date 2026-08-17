import { config } from "dotenv";

config();
config({ path: ".env.test.local", override: false });

if (process.env.NOVO_ISOLATED_E2E === "true") {
  const testUrl = process.env.DATABASE_URL_TEST?.trim();
  const productionUrl = (process.env.DATABASE_URL_PRODUCTION ?? process.env.DATABASE_URL)?.trim();
  if (!testUrl) throw new Error("DATABASE_URL_TEST is required for isolated E2E operations.");
  if (productionUrl && testUrl === productionUrl) throw new Error("DATABASE_URL_TEST must not equal DATABASE_URL.");
  process.env.DATABASE_URL = testUrl;
}

export default {
  schema: "./prisma/schema.prisma",
  datasource: {
    // Prisma CLI otherwise reloads DATABASE_URL from the schema's env()
    // expression and can bypass the isolated child-process selection.
    url: process.env.DATABASE_URL,
  },
};
