import { readFileSync } from "node:fs";
import { sql } from "../src/lib/db";

await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
console.log("Database ready");
await sql.end();
