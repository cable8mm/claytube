import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../youtube/client.js", async () => {
  const actual = await vi.importActual<typeof import("../youtube/client.js")>(
    "../youtube/client.js",
  );

  return {
    ...actual,
    fetchLatestVideos: vi.fn(),
    parseChannelReference: vi.fn((channelUrl: string) => {
      const trimmed = channelUrl.trim();
      if (!trimmed.startsWith("https://") || !trimmed.includes("youtube.com")) {
        throw new Error(`Invalid YouTube channel URL: ${channelUrl}`);
      }
      return { kind: "channel", value: trimmed };
    }),
    resolveYouTubeChannel: vi.fn(),
  };
});

import { main } from "./index.js";
import { fetchLatestVideos, resolveYouTubeChannel } from "../youtube/client.js";

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
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test-api-key";
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY;
    vi.restoreAllMocks();
  });

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

  it("uses the alternate sync config and does not write files during dry-run", async () => {
    const workingDirectory = await mkdtemp(
      join(tmpdir(), "claytube-cli-alt-config-"),
    );

    try {
      process.chdir(workingDirectory);

      await writeFile(
        "claytube.config.yaml",
        `site:\n  title: Default Site\n  description: Default description\nchannels:\n  - https://youtube.com/@default\n`,
      );
      await writeFile(
        "alt.yaml",
        `site:\n  title: Alternate Site\n  description: Alternate description\nchannels:\n  - https://youtube.com/@alternate\n`,
      );

      const before = await snapshotTree(workingDirectory);
      vi.mocked(resolveYouTubeChannel).mockImplementation(
        async (channelUrl) => {
          if (channelUrl === "https://youtube.com/@alternate") {
            return {
              channel: {
                id: "alternate-channel",
                title: "Alternate Channel",
                url: "https://youtube.com/channel/alternate-channel",
                thumbnail: "https://example.com/alternate.jpg",
              },
              uploadsPlaylistId: "alternate-upload-list",
            };
          }

          throw new Error(`Unexpected channel URL: ${channelUrl}`);
        },
      );

      vi.mocked(fetchLatestVideos).mockResolvedValue([
        {
          id: "alternate-video",
          title: "Alternate Video",
          channelId: "alternate-channel",
          publishedAt: "2024-01-01T00:00:00Z",
          thumbnail: "https://example.com/alternate-video.jpg",
          url: "https://youtube.com/watch?v=alternate-video",
        },
      ]);

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await main(["sync", "--config", "alt.yaml", "--dry-run"]);

      expect(resolveYouTubeChannel).toHaveBeenCalledTimes(1);
      expect(resolveYouTubeChannel).toHaveBeenCalledWith(
        "https://youtube.com/@alternate",
        "test-api-key",
      );
      expect(await snapshotTree(workingDirectory)).toEqual(before);
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy.mock.calls.at(-1)?.[0]).toContain("Added");
      expect(logSpy.mock.calls.at(-1)?.[0]).toContain("alternate-channel");
    } finally {
      process.chdir("/");
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it("fails build cleanly when the content snapshot is missing", async () => {
    const workingDirectory = await mkdtemp(
      join(tmpdir(), "claytube-build-no-snapshot-"),
    );

    try {
      process.chdir(workingDirectory);
      await writeFile(
        "claytube.config.yaml",
        [
          "site:",
          "  title: Missing Snapshot Site",
          "  description: Example description",
          "channels:",
          "  - https://youtube.com/@portal",
          "",
        ].join("\n"),
      );

      const before = await snapshotTree(workingDirectory);
      const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await main(["build"]);

      expect(process.exitCode).toBe(1);
      expect(await snapshotTree(workingDirectory)).toEqual(before);
      expect(existsSync(join(workingDirectory, "dist"))).toBe(false);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Build error: No content snapshot"),
      );
    } finally {
      process.exitCode = undefined;
      process.chdir("/");
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it("sync updates content without mutating the built site, and build refreshes the site without mutating the data store", async () => {
    const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
    const previousCwd = process.cwd();
    const originalConfig = await readFile(
      join(repoRoot, "claytube.config.yaml"),
      "utf8",
    );
    const originalChannels = await readFile(
      join(repoRoot, "data", "channels.json"),
      "utf8",
    );
    const originalVideos = await readFile(
      join(repoRoot, "data", "videos.json"),
      "utf8",
    );

    try {
      process.chdir(repoRoot);
      await writeFile(
        join(repoRoot, "claytube.config.yaml"),
        [
          "site:",
          "  title: Example Portal",
          "  description: Example description",
          "channels:",
          "  - https://youtube.com/@portal",
          "",
        ].join("\n"),
      );
      await writeFile(
        join(repoRoot, "data", "channels.json"),
        JSON.stringify(
          {
            channels: [
              {
                id: "portal-channel",
                title: "Portal Channel",
                url: "https://youtube.com/channel/portal-channel",
                thumbnail: "https://example.com/channel.jpg",
              },
            ],
          },
          null,
          2,
        ) + "\n",
      );
      await writeFile(
        join(repoRoot, "data", "videos.json"),
        JSON.stringify(
          {
            videos: [
              {
                id: "portal-video",
                title: "Portal Launch Video",
                channelId: "portal-channel",
                publishedAt: "2024-06-01T00:00:00Z",
                thumbnail: "https://example.com/video.jpg",
                url: "https://youtube.com/watch?v=portal-video",
              },
            ],
          },
          null,
          2,
        ) + "\n",
      );
      await mkdir(join(repoRoot, "dist"), { recursive: true });
      const legacyHtml = "<html><body>legacy portal</body></html>";
      await writeFile(join(repoRoot, "dist", "index.html"), legacyHtml, "utf8");

      vi.mocked(resolveYouTubeChannel).mockResolvedValue({
        channel: {
          id: "portal-channel",
          title: "Portal Channel",
          url: "https://youtube.com/channel/portal-channel",
          thumbnail: "https://example.com/channel.jpg",
        },
        uploadsPlaylistId: "portal-upload-list",
      });
      vi.mocked(fetchLatestVideos).mockResolvedValue([
        {
          id: "portal-video",
          title: "Portal Launch Video",
          channelId: "portal-channel",
          publishedAt: "2024-06-01T00:00:00Z",
          thumbnail: "https://example.com/video.jpg",
          url: "https://youtube.com/watch?v=portal-video",
        },
        {
          id: "portal-video-2",
          title: "Portal Follow-up Video",
          channelId: "portal-channel",
          publishedAt: "2024-06-02T00:00:00Z",
          thumbnail: "https://example.com/video-2.jpg",
          url: "https://youtube.com/watch?v=portal-video-2",
        },
      ]);

      const beforeDist = await readFile(
        join(repoRoot, "dist", "index.html"),
        "utf8",
      );
      await main(["sync"]);
      const afterSyncDist = await readFile(
        join(repoRoot, "dist", "index.html"),
        "utf8",
      );
      expect(afterSyncDist).toBe(beforeDist);

      const updatedVideos = JSON.parse(
        await readFile(join(repoRoot, "data", "videos.json"), "utf8"),
      ) as { videos: { id: string; title: string }[] };
      expect(updatedVideos.videos.map((video) => video.id)).toContain(
        "portal-video-2",
      );

      const beforeBuildData = await readFile(
        join(repoRoot, "data", "videos.json"),
        "utf8",
      );
      await main(["build"]);
      const builtHtml = await readFile(
        join(repoRoot, "dist", "index.html"),
        "utf8",
      );
      expect(builtHtml).toContain("Portal Follow-up Video");

      const afterBuildData = await readFile(
        join(repoRoot, "data", "videos.json"),
        "utf8",
      );
      expect(afterBuildData).toBe(beforeBuildData);
    } finally {
      await writeFile(join(repoRoot, "claytube.config.yaml"), originalConfig);
      await writeFile(
        join(repoRoot, "data", "channels.json"),
        originalChannels,
      );
      await writeFile(join(repoRoot, "data", "videos.json"), originalVideos);
      process.chdir(previousCwd);
      process.exitCode = undefined;
    }
  });

  it("builds a site that includes the configured site title and stored content", async () => {
    const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
    const previousCwd = process.cwd();
    const originalConfig = await readFile(
      join(repoRoot, "claytube.config.yaml"),
      "utf8",
    );
    const originalChannels = await readFile(
      join(repoRoot, "data", "channels.json"),
      "utf8",
    );
    const originalVideos = await readFile(
      join(repoRoot, "data", "videos.json"),
      "utf8",
    );

    try {
      process.chdir(repoRoot);
      await writeFile(
        join(repoRoot, "claytube.config.yaml"),
        [
          "site:",
          "  title: Example Portal",
          "  description: Example description",
          "channels:",
          "  - https://youtube.com/@portal",
          "",
        ].join("\n"),
      );
      await writeFile(
        join(repoRoot, "data", "channels.json"),
        JSON.stringify(
          {
            channels: [
              {
                id: "portal-channel",
                title: "Portal Channel",
                url: "https://youtube.com/channel/portal-channel",
                thumbnail: "https://example.com/channel.jpg",
              },
            ],
          },
          null,
          2,
        ) + "\n",
      );
      await writeFile(
        join(repoRoot, "data", "videos.json"),
        JSON.stringify(
          {
            videos: [
              {
                id: "portal-video",
                title: "Portal Launch Video",
                channelId: "portal-channel",
                publishedAt: "2024-06-01T00:00:00Z",
                thumbnail: "https://example.com/video.jpg",
                url: "https://youtube.com/watch?v=portal-video",
              },
            ],
          },
          null,
          2,
        ) + "\n",
      );

      await main(["build"]);

      const builtHtml = await readFile(
        join(repoRoot, "dist", "index.html"),
        "utf8",
      );
      expect(builtHtml).toContain("Example Portal");
      expect(builtHtml).toContain("Portal Launch Video");
    } finally {
      await writeFile(join(repoRoot, "claytube.config.yaml"), originalConfig);
      await writeFile(
        join(repoRoot, "data", "channels.json"),
        originalChannels,
      );
      await writeFile(join(repoRoot, "data", "videos.json"), originalVideos);
      process.chdir(previousCwd);
    }
  });
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
