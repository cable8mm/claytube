import { parse } from "yaml";
import { parseChannelReference } from "./src/youtube/client.js";

export interface Config {
  site: { title: string; description?: string; url?: string; base?: string };
  channels: string[];
}

export function parseConfig(content: string): Config {
  const config = parse(content);

  if (
    !config ||
    typeof config !== "object" ||
    !("channels" in config) ||
    !Array.isArray(config.channels) ||
    config.channels.length === 0
  ) {
    throw new Error("Missing channels");
  }

  for (const url of config.channels) {
    if (typeof url !== "string" || url.trim() === "") {
      throw new Error(`Invalid channel URL: ${url}`);
    }

    try {
      parseChannelReference(url);
    } catch {
      throw new Error(`Invalid channel URL: ${url}`);
    }
  }

  return config as Config;
}
