import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { ConfigError, loadConfig } from "./src/config/loadConfig.js";
import { parseConfig } from "./config.js";

describe("parseConfig", () => {
  it("should load a valid config", () => {
    const yaml = `
site:
  title: My Hub
channels:
  - https://www.youtube.com/@cable8mm
`;
    const config = parseConfig(yaml);
    expect(config.site.title).toBe("My Hub");
    expect(config.channels).toContain("https://www.youtube.com/@cable8mm");
  });

  it("should throw error on missing channels", () => {
    const yaml = `
site:
  title: My Hub
channels: []
`;
    expect(() => parseConfig(yaml)).toThrow("Missing channels");
  });

  it("should throw error on invalid channel URL", () => {
    const yaml = `
site:
  title: My Hub
channels:
  - https://not-youtube.com/user
`;
    expect(() => parseConfig(yaml)).toThrow("Invalid channel URL");
  });
});

describe("loadConfig", () => {
  it("preserves channel order and duplicates while validating URLs", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "claytube-config-"));

    try {
      const configPath = join(tempDir, "claytube.config.yaml");
      await writeFile(
        configPath,
        `site:\n  title: My Hub\n  description: A great channel list\nchannels:\n  - https://youtube.com/@first\n  - https://youtube.com/@first\n  - https://youtube.com/@second\n`,
      );

      const config = await loadConfig(configPath);
      expect(config.channels).toEqual([
        "https://youtube.com/@first",
        "https://youtube.com/@first",
        "https://youtube.com/@second",
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("throws a configuration error when the file is missing or unreadable", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "claytube-config-"));

    try {
      await expect(loadConfig(join(tempDir, "missing.yaml"))).rejects.toThrow(
        ConfigError,
      );

      const unreadablePath = join(tempDir, "not-readable.yaml");
      await writeFile(unreadablePath, "site: {}\n");

      await expect(loadConfig(unreadablePath)).rejects.toThrow(ConfigError);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("throws a configuration error for empty and malformed channel lists", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "claytube-config-"));

    try {
      const emptyPath = join(tempDir, "empty.yaml");
      await writeFile(
        emptyPath,
        "site:\n  title: My Hub\n  description: Example\nchannels: []\n",
      );

      await expect(loadConfig(emptyPath)).rejects.toThrow(
        /channels.*at least one|empty/i,
      );

      const malformedPath = join(tempDir, "malformed.yaml");
      await writeFile(
        malformedPath,
        "site:\n  title: My Hub\n  description: Example\nchannels:\n  - https://not-youtube.com/user\n",
      );

      await expect(loadConfig(malformedPath)).rejects.toThrow(
        /https:\/\/not-youtube\.com\/user|invalid channel/i,
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
