import { defineConfig } from "drizzle-kit";

/**
 * Migrations are generated as plain SQLite SQL and applied through Wrangler
 * (`wrangler d1 migrations apply`), so no database credentials are needed here.
 */
export default defineConfig({
	dialect: "sqlite",
	schema: "./src/schema.ts",
	out: "./drizzle",
});
