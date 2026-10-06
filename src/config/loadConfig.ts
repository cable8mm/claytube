import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { parseChannelReference } from "../youtube/client.js";

export interface ClayTubeConfig {
  site: {
    title: string;
    description: string;
    url?: string;
    base?: string;
  };
  channels: string[];
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export async function loadConfig(
  configPath = "claytube.config.yaml",
): Promise<ClayTubeConfig> {
  const absolutePath = resolve(configPath);

  let source: string;
  try {
    source = await readFile(absolutePath, "utf8");
  } catch (error: unknown) {
    throw new ConfigError(
      `${absolutePath}: cannot read config file: ${getErrorMessage(error)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = parse(source);
  } catch (error: unknown) {
    throw new ConfigError(
      `${absolutePath}: config is not valid YAML: ${getErrorMessage(error)}`,
    );
  }

  return validateConfig(parsed, absolutePath);
}

function validateConfig(value: unknown, sourcePath: string): ClayTubeConfig {
  if (!isRecord(value)) {
    throw new ConfigError(`${sourcePath}: config must be an object`);
  }

  const site = value.site;
  if (!isRecord(site)) {
    throw new ConfigError(`${sourcePath}: site must be an object`);
  }

  const title = site.title;
  if (typeof title !== "string" || title.trim() === "") {
    throw new ConfigError(
      `${sourcePath}: site.title must be a non-empty string`,
    );
  }

  const description = site.description;
  if (typeof description !== "string" || description.trim() === "") {
    throw new ConfigError(
      `${sourcePath}: site.description must be a non-empty string`,
    );
  }

  const channels = value.channels;
  if (!Array.isArray(channels) || channels.length === 0) {
    throw new ConfigError(
      `${sourcePath}: channels must contain at least one YouTube channel URL`,
    );
  }

  const validatedChannels: string[] = [];
  for (const [index, channel] of channels.entries()) {
    if (typeof channel !== "string" || channel.trim() === "") {
      throw new ConfigError(
        `${sourcePath}: channels[${index}] must be a non-empty string`,
      );
    }

    const trimmedChannel = channel.trim();
    try {
      parseChannelReference(trimmedChannel);
    } catch (error: unknown) {
      const reason = getErrorMessage(error);
      throw new ConfigError(
        `${sourcePath}: invalid channel URL ${trimmedChannel}: ${reason}`,
      );
    }

    validatedChannels.push(trimmedChannel);
  }

  return {
    site: {
      title: title.trim(),
      description: description.trim(),
    },
    channels: validatedChannels,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
