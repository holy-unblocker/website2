import { db } from "./config/apis.js";
import { readFileSync } from "node:fs";
import path from "node:path";

await db.query(readFileSync(path.join(import.meta.dirname, "db.sql"), "utf8"));
console.log("Database seeded");
process.exit();
