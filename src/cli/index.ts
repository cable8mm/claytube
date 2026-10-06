#!/usr/bin/env node

import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/loadConfig.js";
import { syncYouTubeData } from "../sync/syncYouTubeData.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "init") {
    await initProject(args.slice(1));
    return;
  }

  if (command === "sync") {
    await sync(args);
    return;
  }

  if (command === "build") {
    await buildSite(args.slice(1));
    return;
  }

  throw new Error("Usage: claytube <init|sync|build> [options]");
}

export async function initProject(args: string[]): Promise<void> {
  const targetArg = args.find((arg) => !arg.startsWith("-")) ?? ".";
  const targetDir = resolve(targetArg);
  const shouldInitGit = args.includes("--git");

  if (existsSync(targetDir)) {
    const entries = await readdir(targetDir);

    if (entries.length > 0) {
      throw new Error(`${targetDir} is not empty`);
    }
  } else {
    await mkdir(targetDir, { recursive: true });
  }

  await copyTemplate(findTemplateDir(), targetDir);

  if (shouldInitGit) {
    initGit(targetDir);
  }

  console.log(`Created ClayTube project at ${targetDir}`);
}

async function sync(args: string[]): Promise<void> {
  const configPath = readOption(args, "--config") ?? "claytube.config.yaml";
  const config = await loadConfig(configPath);
  const result = await syncYouTubeData(config);

  console.log(
    `Synced ${result.channels.length} channel(s) and ${result.videos.length} video(s).`,
  );
}

async function buildSite(args: string[]): Promise<void> {
  const buildArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config") {
      i++;
      continue;
    }
    buildArgs.push(args[i]);
  }

  const astroBinPath = join(process.cwd(), "node_modules", "astro", "astro.js");

  if (!existsSync(astroBinPath)) {
    throw new Error(
      "Astro is not installed in this project. Run npm install, then try claytube build again.",
    );
  }

  const result = spawnSync(
    process.execPath,
    [astroBinPath, "build", ...buildArgs],
    {
      env: process.env,
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 1;
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
): Promise<void> {
  const entries = await readdir(templateDir);

  await Promise.all(
    entries.map((entry) =>
      cp(join(templateDir, entry), join(targetDir, entry), {
        recursive: true,
        errorOnExist: true,
        force: false,
      }),
    ),
  );
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

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
