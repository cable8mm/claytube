#!/usr/bin/env node

import "dotenv/config";
import { Command, CommanderError } from "commander";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig } from "../config/loadConfig.js";
import {
  formatChangeReport,
  syncYouTubeData,
} from "../sync/syncYouTubeData.js";

const cliUsage = "Usage: claytube <init|sync|build|deploy> [options]";

export async function main(args = process.argv.slice(2)): Promise<void> {
  const program = new Command()
    .name("claytube")
    .allowUnknownOption(false)
    .allowExcessArguments(false)
    .helpOption(false)
    .addHelpCommand(false)
    .exitOverride()
    .configureOutput({ writeErr: () => {} });

  strictCommand(program.command("init [target]"))
    .option("--git")
    .action(async (target: string | undefined, options: { git?: boolean }) => {
      const initArgs = target === undefined ? [] : [target];
      if (options.git) {
        initArgs.push("--git");
      }
      await initProject(initArgs);
    });

  strictCommand(program.command("sync"))
    .option("--config <path>")
    .option("--dry-run")
    .action(async (options: { config?: string; dryRun?: boolean }) => {
      const syncArgs = ["sync"];
      if (options.config !== undefined) {
        syncArgs.push("--config", options.config);
      }
      if (options.dryRun) {
        syncArgs.push("--dry-run");
      }
      await sync(syncArgs);
    });

  strictCommand(program.command("build")).action(() => buildSite());
  strictCommand(program.command("deploy")).action(() => deploySite());

  try {
    await program.parseAsync(args, { from: "user" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      error instanceof CommanderError ? `${cliUsage}\n${message}` : message,
    );
    process.exitCode = 1;
  }
}

function strictCommand(command: Command): Command {
  return command
    .allowUnknownOption(false)
    .allowExcessArguments(false)
    .helpOption(false)
    .addHelpCommand(false);
}

export async function initProject(
  args: string[],
  copyEntry: typeof cp = cp,
): Promise<void> {
  const targetArg = args.find((arg) => !arg.startsWith("-")) ?? ".";
  const targetDir = resolve(targetArg);
  const shouldInitGit = args.includes("--git");
  const targetExists = existsSync(targetDir);

  if (targetExists) {
    let entries: string[];
    try {
      entries = await readdir(targetDir);
    } catch (error: unknown) {
      throw new Error(
        `Initialization error: cannot read target ${targetDir}: ${getErrorMessage(error)}`,
        { cause: error },
      );
    }

    if (entries.length > 0) {
      throw new Error(`Initialization error: ${targetDir} is not empty.`);
    }
  } else {
    await mkdir(targetDir, { recursive: true });
  }

  const createdEntries: string[] = [];
  try {
    await copyTemplate(findTemplateDir(), targetDir, createdEntries, copyEntry);

    if (shouldInitGit) {
      initGit(targetDir);
    }

    console.log(`Created ClayTube project at ${targetDir}`);
  } catch (error: unknown) {
    const cleanupErrors: unknown[] = [];
    if (targetExists) {
      for (const entry of createdEntries) {
        try {
          await rm(join(targetDir, entry), { recursive: true, force: true });
        } catch (cleanupError: unknown) {
          cleanupErrors.push(cleanupError);
        }
      }
    } else {
      try {
        await rm(targetDir, { recursive: true, force: true });
      } catch (cleanupError: unknown) {
        cleanupErrors.push(cleanupError);
      }
    }

    const reason = getErrorMessage(error);
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        `Initialization error at ${targetDir}; cleanup failed: ${cleanupErrors.map(getErrorMessage).join("; ")}`,
        { cause: error },
      );
    }
    throw new Error(`Initialization error at ${targetDir}: ${reason}`, {
      cause: error,
    });
  }
}

async function sync(args: string[]): Promise<void> {
  const configPath = readOption(args, "--config") ?? "claytube.config.yaml";
  const dryRun = args.includes("--dry-run");
  const config = await loadConfig(configPath);
  const result = await syncYouTubeData(config, { dryRun });

  console.log(formatChangeReport(result.changeReport));
}

export async function buildSite(): Promise<void> {
  const config = await loadConfig("claytube.config.yaml");

  if (!config.site.title || config.site.title.trim() === "") {
    throw new Error("Build error: site.title must be a non-empty string");
  }

  const snapshotFiles = [
    join(process.cwd(), "data", "channels.json"),
    join(process.cwd(), "data", "videos.json"),
  ];
  const hasSnapshot = snapshotFiles.every((filePath) => existsSync(filePath));

  if (!hasSnapshot) {
    throw new Error(
      "Build error: No content snapshot found. Run claytube sync before claytube build.",
    );
  }

  const astroBinPath = join(
    process.cwd(),
    "node_modules",
    "astro",
    "bin",
    "astro.mjs",
  );

  if (!existsSync(astroBinPath)) {
    throw new Error(
      "Astro is not installed in this project. Run npm install, then try claytube build again.",
    );
  }

  const distPath = join(process.cwd(), "dist");
  const backupSuffix = `.${Date.now()}.${Math.random().toString(16).slice(2)}`;
  const backupPath = `${distPath}${backupSuffix}`;
  const hadPreviousBuild = existsSync(distPath);

  try {
    if (hadPreviousBuild) {
      await rename(distPath, backupPath);
    }

    const result = spawnSync(process.execPath, [astroBinPath, "build"], {
      env: process.env,
      stdio: "inherit",
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error(
        `Build error: Astro build failed with exit code ${result.status ?? "unknown"}`,
      );
    }

    process.exitCode = 0;
  } catch (error: unknown) {
    if (existsSync(distPath)) {
      await rm(distPath, { recursive: true, force: true });
    }

    if (hadPreviousBuild && existsSync(backupPath)) {
      await rename(backupPath, distPath);
    } else if (existsSync(backupPath)) {
      await rm(backupPath, { recursive: true, force: true });
    }

    if (error instanceof Error && error.message.startsWith("Build error:")) {
      throw error;
    }

    const reason = getErrorMessage(error);
    const finalMessage = reason.startsWith("Build error:")
      ? reason
      : `Build error: ${reason}`;
    throw new Error(finalMessage, { cause: error });
  }
}

export async function deploySite(): Promise<void> {
  const siteDir = resolve(process.cwd(), "dist");
  const indexPath = join(siteDir, "index.html");

  if (!existsSync(indexPath)) {
    throw new Error("Publish error: no complete built site found.");
  }

  const repoRoot = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (repoRoot.status !== 0 || !repoRoot.stdout.trim()) {
    throw new Error(
      "Publish error: a Git repository is required for GitHub Pages deployment.",
    );
  }

  const remoteUrl = spawnSync("git", ["remote", "get-url", "origin"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (remoteUrl.status !== 0 || !remoteUrl.stdout.trim()) {
    throw new Error(
      "Publish error: Git remote origin is not configured for GitHub Pages deployment.",
    );
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "claytube-deploy-"));

  try {
    const stagingDir = join(tempRoot, "site");
    await mkdir(stagingDir, { recursive: true });

    const init = spawnSync("git", ["init", "--initial-branch=gh-pages"], {
      cwd: stagingDir,
      env: process.env,
      encoding: "utf8",
    });

    if (init.status !== 0) {
      throw new Error(
        `Publish error: unable to initialize the gh-pages branch: ${init.stderr || init.stdout || "unknown git error"}`,
      );
    }

    const remoteAdd = spawnSync("git", ["remote", "add", "origin", remoteUrl.stdout.trim()], {
      cwd: stagingDir,
      env: process.env,
      encoding: "utf8",
    });

    if (remoteAdd.status !== 0) {
      throw new Error(
        `Publish error: unable to configure publication remote: ${remoteAdd.stderr || remoteAdd.stdout || "unknown git error"}`,
      );
    }

    for (const entry of await readdir(siteDir)) {
      const source = join(siteDir, entry);
      const target = join(stagingDir, entry);
      await cp(source, target, { recursive: true, force: true });
    }

    const add = spawnSync("git", ["add", "."], {
      cwd: stagingDir,
      env: process.env,
      encoding: "utf8",
    });

    if (add.status !== 0) {
      throw new Error(
        `Publish error: unable to stage the site for publication: ${add.stderr || add.stdout || "unknown git error"}`,
      );
    }

    const commit = spawnSync(
      "git",
      [
        "-c",
        "user.name=ClayTube",
        "-c",
        "user.email=claytube@local",
        "commit",
        "-m",
        "Deploy ClayTube site",
      ],
      {
        cwd: stagingDir,
        env: process.env,
        encoding: "utf8",
      },
    );

    if (commit.status !== 0) {
      const output = `${commit.stdout || ""}${commit.stderr || ""}`.trim();
      if (!output.includes("nothing to commit")) {
        throw new Error(
          `Publish error: unable to commit the published site: ${output || "unknown git error"}`,
        );
      }
    }

    const push = spawnSync("git", ["push", "origin", "HEAD:gh-pages"], {
      cwd: stagingDir,
      env: process.env,
      encoding: "utf8",
    });

    if (push.status !== 0) {
      throw new Error(
        `Publish error: GitHub Pages deployment failed while pushing the gh-pages branch: ${push.stderr || push.stdout || "unknown git error"}`,
      );
    }

    console.log("Published built site to GitHub Pages.");
    process.exitCode = 0;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function initGit(cwd: string): void {
  const result = spawnSync("git", ["init"], {
    cwd,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error("git init failed");
  }
}

async function copyTemplate(
  templateDir: string,
  targetDir: string,
  createdEntries: string[],
  copyEntry: typeof cp,
): Promise<void> {
  const entries = await readdir(templateDir);

  for (const entry of entries) {
    createdEntries.push(entry);
    await copyEntry(join(templateDir, entry), join(targetDir, entry), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function findTemplateDir(): string {
  const candidates = [
    new URL("../../templates/default/", import.meta.url),
    new URL("../../../templates/default/", import.meta.url),
  ].map((url) => fileURLToPath(url));

  const templateDir = candidates.find((candidate) => existsSync(candidate));

  if (!templateDir) {
    throw new Error("ClayTube project template is missing");
  }

  return templateDir;
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value) {
    throw new Error(`${name} requires a value`);
  }

  return value;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await main();
}
