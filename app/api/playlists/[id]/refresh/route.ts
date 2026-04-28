import { NextRequest } from "next/server";
import { getPlaylistById, getSongsForPlaylist, recordSong } from "@/lib/db";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/playlists/[id]/refresh">,
) {
  const { id } = await ctx.params;
  const playlist = getPlaylistById(id);
  if (!playlist) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const folder = playlist.folder;
  fs.mkdirSync(folder, { recursive: true });
  const archivePath = path.join(folder, "archive.txt");

  // Capture timestamp before running so we know what was "new" afterwards
  const refreshStartAt = Math.floor(Date.now() / 1000);

  const knownSongs = new Set(getSongsForPlaylist(id).map((s) => s.filename));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "meta", playlistId: id, refreshStartAt })}\n\n`,
        ),
      );

      const args = [
        "--downloader",
        "aria2c",
        "--downloader-args",
        "-c -j 3 -x 3 -s 3 -k 1M",
        "-x",
        "-f",
        "bestaudio",
        "--add-metadata",
        "--embed-thumbnail",
        "--download-archive",
        archivePath,
        playlist.url,
      ];

      const proc = spawn("yt-dlp", args, { cwd: folder });

      function send(text: string) {
        const escaped = text
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "");
        controller.enqueue(
          encoder.encode(`data: {"type":"log","line":"${escaped}"}\n\n`),
        );
      }

      proc.stdout.on("data", (chunk: Buffer) => {
        chunk.toString("utf8").split("\n").filter(Boolean).forEach(send);
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        chunk.toString("utf8").split("\n").filter(Boolean).forEach(send);
      });

      proc.on("close", (code) => {
        try {
          const audioExts = new Set([
            ".mp3",
            ".m4a",
            ".opus",
            ".flac",
            ".wav",
            ".ogg",
            ".aac",
          ]);
          const entries = fs
            .readdirSync(folder)
            .filter((f) => audioExts.has(path.extname(f).toLowerCase()));

          const newSongs: string[] = [];
          for (const filename of entries) {
            if (!knownSongs.has(filename)) {
              recordSong(id, filename);
              newSongs.push(filename);
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", code, newSongs, playlistId: id, refreshStartAt })}\n\n`,
            ),
          );
        } catch {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", code, newSongs: [], playlistId: id, refreshStartAt })}\n\n`,
            ),
          );
        }
        controller.close();
      });

      proc.on("error", (err) => {
        send(`[error] ${err.message}`);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", code: -1, newSongs: [], playlistId: id, refreshStartAt })}\n\n`,
          ),
        );
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
