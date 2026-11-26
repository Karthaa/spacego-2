#!/usr/bin/env node
// Combine SQL files into one script for a single Run in the Supabase SQL editor.
//
//   node tooling/sql/bundle.mjs migrations 20261126 20261204 > all.sql
//     Every migration from 20261126 to 20261204, in order, inside ONE
//     transaction: if any statement fails, nothing is applied. The files' own
//     top-level BEGIN;/COMMIT; lines are dropped so the outer transaction holds.
//
//   node tooling/sql/bundle.mjs tests > tests.sql
//     Every supabase/tests/*_test.sql, one after another. Each test already
//     runs in its own transaction and ends with ROLLBACK, so nothing persists.
//
// Prints to stdout. Reads only files in this repository.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const [kind, from, to] = process.argv.slice(2);
const root = fileURLToPath(new URL("../../", import.meta.url));

function read(dir, name) {
  // Normalise Windows line endings so the output is the same on every machine.
  return readFileSync(join(root, dir, name), "utf8").replace(/\r\n/g, "\n");
}

if (kind === "migrations") {
  if (!/^\d{8}$/.test(from ?? "") || !/^\d{8}$/.test(to ?? "")) {
    console.error("usage: bundle.mjs migrations <from YYYYMMDD> <to YYYYMMDD>");
    process.exit(2);
  }
  const files = readdirSync(join(root, "supabase/migrations"))
    .filter((f) => /^\d{8}_.*\.sql$/.test(f))
    .filter((f) => f.slice(0, 8) >= from && f.slice(0, 8) <= to)
    .sort();
  if (files.length === 0) {
    console.error("no migrations in that range");
    process.exit(1);
  }
  const out = [
    `-- Migrations ${from} to ${to}: ${files.length} files, applied as ONE transaction.`,
    "-- If anything fails, nothing is applied.",
    "BEGIN;",
  ];
  for (const f of files) {
    const body = read("supabase/migrations", f)
      .split("\n")
      .filter((line) => !/^(BEGIN|COMMIT);\s*$/.test(line))
      .join("\n");
    out.push("", `-- ===== ${f} =====`, body);
  }
  out.push("", "COMMIT;", "");
  process.stdout.write(out.join("\n"));
} else if (kind === "tests") {
  const files = readdirSync(join(root, "supabase/tests"))
    .filter((f) => f.endsWith("_test.sql"))
    .sort();
  const out = [`-- ${files.length} test files. Each runs in its own transaction and rolls back.`];
  for (const f of files) out.push("", `-- ===== ${f} =====`, read("supabase/tests", f));
  process.stdout.write(out.join("\n") + "\n");
} else {
  console.error("usage: bundle.mjs migrations <from> <to> | tests");
  process.exit(2);
}
