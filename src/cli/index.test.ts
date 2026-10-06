import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cliEntry = fileURLToPath(new URL("./index.ts", import.meta.url));
const tsxLoader = import.meta.resolve("tsx");

const rejectedInvocations = [
  { args: ["unknown-command"], error: "unknown-command" },
  { args: ["init", "--unknown-option"], error: "--unknown-option" },
  { args: ["init", "one", "two"], error: "too many arguments" },
  { args: ["init", "--config", "alternate.yaml"], error: "--config" },
  { args: ["sync", "--git"], error: "--git" },
  { args: ["build", "--dry-run"], error: "--dry-run" },
  { args: ["deploy", "--config", "alternate.yaml"], error: "--config" },
];

describe("CLI invocation validation", () => {
  it.each(rejectedInvocations)(
    "rejects $args without changing project files",
    async ({ args, error }) => {
      const workingDirectory = await mkdtemp(
        join(tmpdir(), "claytube-cli-validation-"),
      );

      try {
        await mkdir(join(workingDirectory, "nested"));
        await writeFile(join(workingDirectory, "keep.txt"), "unchanged");
        await writeFile(
          join(workingDirectory, "nested", "keep.txt"),
          "also unchanged",
        );
        const before = await snapshotTree(workingDirectory);
        const result = spawnSync(
          process.execPath,
          ["--import", tsxLoader, cliEntry, ...args],
          { cwd: workingDirectory, encoding: "utf8" },
        );

        expect(result.error).toBeUndefined();
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("Usage: claytube");
        expect(result.stderr).toContain(error);
        expect(await snapshotTree(workingDirectory)).toEqual(before);
      } finally {
        await rm(workingDirectory, { recursive: true, force: true });
      }
    },
  );
});

async function snapshotTree(directory: string): Promise<string[]> {
  const snapshot: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);
    const relativePath = path.slice(directory.length + 1);

    if (entry.isDirectory()) {
      snapshot.push(`directory:${relativePath}`);
      snapshot.push(...(await snapshotTree(path)));
    } else {
      const content = await readFile(path, "base64");
      snapshot.push(`file:${relativePath}:${content}`);
    }
  }

  return snapshot.sort();
}
