// Sorts LABELS array in src/labels.ts alphabetically by id.

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const LABELS_PATH = resolve(process.cwd(), "src/labels.ts");

const src: string = readFileSync(LABELS_PATH, "utf8");

// Match the full LABELS array block
const arrayMatch = src.match(
  /^(export const LABELS: Label\[\] = \[)([\s\S]*?)^(\];)/m
);

if (!arrayMatch) {
  console.error("Could not find LABELS array in src/labels.ts");
  process.exit(1);
}

const [, openLine, body, closeLine] = arrayMatch as [string, string, string, string];

// Extract individual entry lines (each is a full { id: "...", name: "..." } line)
const lines: string[] = body
  .split("\n")
  .map((l) => l.trimEnd())
  .filter((l) => l.trim().startsWith("{"));

// Sort by id value (case-insensitive, locale-aware for hyphenated entries)
const sorted: string[] = [...lines].sort((a, b) => {
  const idA = a.match(/id:\s*"([^"]+)"/)?.[1] ?? "";
  const idB = b.match(/id:\s*"([^"]+)"/)?.[1] ?? "";
  return idA.localeCompare(idB, undefined, { sensitivity: "base" });
});

if (lines.join("\n") === sorted.join("\n")) {
  console.log("✓ labels.ts already sorted");
  process.exit(0);
}

// Re-emit with consistent alignment
const realigned: string[] = sorted.map((l) => {
  const id = l.match(/id:\s*"([^"]+)"/)?.[1] ?? "";
  const name = l.match(/name:\s*"([^"]+)"/)?.[1] ?? "";
  const prefix = `  { id: "${id}",`;
  return `${prefix.padEnd(34)}name: "${name}" },`;
});

const newBody = "\n" + realigned.join("\n") + "\n";
const newSrc = src.replace(
  /^(export const LABELS: Label\[\] = \[)([\s\S]*?)^(\];)/m,
  `${openLine}${newBody}${closeLine}`
);

writeFileSync(LABELS_PATH, newSrc, "utf8");
console.log("✓ labels.ts sorted");