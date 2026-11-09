import postgres from "postgres";

const g = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

export const sql =
  g.__sql ??
  postgres(process.env.DATABASE_URL ?? "postgres://daybreak:daybreak@localhost:5432/daybreak", {
    max: 5,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") g.__sql = sql;
