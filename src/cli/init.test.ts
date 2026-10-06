import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initProject } from "./index.js";
import {
  cp,
  mkdtemp,
  rm,
  readdir,
  readFile,
  writeFile,
  mkdir,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const cliEntry = fileURLToPath(new URL("./index.ts", import.meta.url));
const tsxLoader = import.meta.resolve("tsx");

describe("claytube init smoke tests", () => {
  let tempBaseDir: string;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), "claytube-test-"));
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it("should successfully initialize a project in an empty directory", async () => {
    const targetDir = join(tempBaseDir, "my-new-site");
    const credential = "init-test-credential";
    const previousCredential = process.env.YOUTUBE_API_KEY;
    process.env.YOUTUBE_API_KEY = credential;

    try {
      await initProject([targetDir]);
    } finally {
      if (previousCredential === undefined) {
        delete process.env.YOUTUBE_API_KEY;
      } else {
        process.env.YOUTUBE_API_KEY = previousCredential;
      }
    }

    const entries = await readdir(targetDir);
    expect(entries).toContain("claytube.config.yaml");
    expect(entries).toContain("package.json");
    expect(entries).toContain("src");
    expect(
      JSON.parse(await readFile(join(targetDir, "data/channels.json"), "utf8")),
    ).toEqual({ channels: [] });
    expect(
      JSON.parse(await readFile(join(targetDir, "data/videos.json"), "utf8")),
    ).toEqual({ videos: [] });
    expect(await readTree(targetDir)).not.toContain(credential);
  });

  it("should throw an error when the target directory is not empty", async () => {
    const targetDir = join(tempBaseDir, "not-empty");
    await mkdir(targetDir);
    await writeFile(join(targetDir, "dummy.txt"), "content");
    const before = await snapshotTree(targetDir);

    await expect(initProject([targetDir])).rejects.toThrow(
      /Initialization error.*is not empty/,
    );
    expect(await snapshotTree(targetDir)).toEqual(before);
  });

  it("should remove everything created when template copying fails", async () => {
    const targetDir = join(tempBaseDir, "partial-site");
    let copyCount = 0;
    const failDuringCopy: typeof cp = async (source, destination, options) => {
      copyCount++;
      if (copyCount === 2) {
        throw new Error("simulated copy failure");
      }
      await cp(source, destination, options);
    };

    await expect(initProject([targetDir], failDuringCopy)).rejects.toThrow(
      /Initialization error.*simulated copy failure/,
    );
    expect(copyCount).toBe(2);
    expect(existsSync(targetDir)).toBe(false);
  });

  it("should leave an existing empty target empty when copying fails", async () => {
    const targetDir = join(tempBaseDir, "empty-site");
    await mkdir(targetDir);
    let copyCount = 0;
    const failDuringCopy: typeof cp = async (source, destination, options) => {
      copyCount++;
      if (copyCount === 2) {
        throw new Error("simulated copy failure");
      }
      await cp(source, destination, options);
    };

    await expect(initProject([targetDir], failDuringCopy)).rejects.toThrow(
      /Initialization error.*simulated copy failure/,
    );
    expect(await readdir(targetDir)).toEqual([]);
  });

  it("should initialize the current working directory without a target", async () => {
    const workingDirectory = join(tempBaseDir, "current-project");
    await mkdir(workingDirectory);
    const result = spawnSync(
      process.execPath,
      ["--import", tsxLoader, cliEntry, "init"],
      {
        cwd: workingDirectory,
        encoding: "utf8",
        env: { ...process.env, YOUTUBE_API_KEY: "init-test-credential" },
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(
      await readFile(join(workingDirectory, "claytube.config.yaml"), "utf8"),
    ).toContain("site:");
    expect(
      JSON.parse(
        await readFile(join(workingDirectory, "data/channels.json"), "utf8"),
      ),
    ).toEqual({ channels: [] });
    expect(await readTree(workingDirectory)).not.toContain(
      "init-test-credential",
    );
  });

  it("should initialize version control only when --git is given", async () => {
    const gitTarget = join(tempBaseDir, "with-git");
    const gitInit = runCli(tempBaseDir, ["init", gitTarget, "--git"]);

    expect(gitInit.error).toBeUndefined();
    expect(gitInit.status).toBe(0);
    expect(existsSync(join(gitTarget, ".git"))).toBe(true);

    const gitProbe = spawnSync(
      "git",
      ["-C", gitTarget, "rev-parse", "--is-inside-work-tree"],
      { encoding: "utf8" },
    );
    expect(gitProbe.status).toBe(0);
    expect(gitProbe.stdout.trim()).toBe("true");

    const plainTarget = join(tempBaseDir, "without-git");
    const plainInit = runCli(tempBaseDir, ["init", plainTarget]);

    expect(plainInit.error).toBeUndefined();
    expect(plainInit.status).toBe(0);
    expect(existsSync(join(plainTarget, ".git"))).toBe(false);
  });

  it("should remove the initialized project when Git cannot be run", async () => {
    const targetDir = join(tempBaseDir, "git-failure");
    const result = runCli(tempBaseDir, ["init", targetDir, "--git"], {
      ...process.env,
      PATH: "",
    });

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Initialization error");
    expect(result.stderr).toContain(targetDir);
    expect(existsSync(targetDir)).toBe(false);
    expect(await readdir(tempBaseDir)).toEqual([]);
  });
});

function runCli(
  workingDirectory: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  return spawnSync(
    process.execPath,
    ["--import", tsxLoader, cliEntry, ...args],
    { cwd: workingDirectory, encoding: "utf8", env },
  );
}

async function snapshotTree(
  directory: string,
  relativeDirectory = "",
): Promise<string[]> {
  const snapshot: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);
    const relativePath = join(relativeDirectory, entry.name);

    if (entry.isDirectory()) {
      snapshot.push(`directory:${relativePath}`);
      snapshot.push(...(await snapshotTree(path, relativePath)));
    } else {
      snapshot.push(`file:${relativePath}:${await readFile(path, "base64")}`);
    }
  }

  return snapshot.sort();
}

async function readTree(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    contents.push(
      entry.isDirectory() ? await readTree(path) : await readFile(path, "utf8"),
    );
  }

  return contents.join("\n");
}
