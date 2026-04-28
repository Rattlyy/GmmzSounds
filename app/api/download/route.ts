import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  getOrCreatePlaylist,
  getPlaylistByUrl,
  recordSong,
  getSongsForPlaylist,
} from "@/lib/db";

// Only allow well-formed http/https URLs (no shell metacharacters)
function sanitizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return null;
    // Reject any characters that could escape argv boundaries in edge cases
    if (/[\x00-\x1f\x7f"'`\\;|&$<>(){}[\]!#]/.test(trimmed)) return null;
    return trimmed;
  } catch {
    return null;
  }
}

const DOWNLOADS_ROOT = path.join(process.cwd(), "downloads");

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.url !== "string") {
    return new Response(JSON.stringify({ error: "Missing url" }), {
      status: 400,
    });
  }

  const safeUrl = sanitizeUrl(body.url);
  if (!safeUrl) {
    return new Response(JSON.stringify({ error: "Invalid URL" }), {
      status: 400,
    });
  }

  // Resolve or create playlist record
  let playlist = getPlaylistByUrl(safeUrl);
  if (!playlist) {
    const id = crypto.randomBytes(8).toString("hex");
    const folder = path.join(DOWNLOADS_ROOT, id);
    fs.mkdirSync(folder, { recursive: true });
    playlist = getOrCreatePlaylist(safeUrl, folder, id);
  }

  const folder = playlist.folder;
  fs.mkdirSync(folder, { recursive: true });

  // Build the archive file path (yt-dlp uses this to track downloaded items)
  const archivePath = path.join(folder, "archive.txt");

  // Snapshot which songs exist before download so we can detect new ones
  const knownSongs = new Set(
    getSongsForPlaylist(playlist.id).map((s) => s.filename),
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send a preamble so the client knows the playlist id
      controller.enqueue(
        encoder.encode(
          `data: {"type":"meta","playlistId":"${playlist!.id}"}\n\n`,
        ),
      );

      // All arguments are passed as an array — no shell involved, safe from injection
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
        safeUrl!,
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
        const lines = chunk.toString("utf8").split("\n");
        for (const line of lines) {
          if (line.trim()) send(line);
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        const lines = chunk.toString("utf8").split("\n");
        for (const line of lines) {
          if (line.trim()) send(line);
        }
      });

      proc.on("close", (code) => {
        // Detect newly downloaded files by scanning the folder
        try {
          const entries = fs.readdirSync(folder).filter((f) => {
            const ext = path.extname(f).toLowerCase();
            return [
              ".mp3",
              ".m4a",
              ".opus",
              ".flac",
              ".wav",
              ".ogg",
              ".aac",
            ].includes(ext);
          });
          const newSongs: string[] = [];
          for (const filename of entries) {
            if (!knownSongs.has(filename)) {
              recordSong(playlist!.id, filename);
              newSongs.push(filename);
            }
          }

          const summary = JSON.stringify({
            type: "done",
            code,
            newSongs,
            playlistId: playlist!.id,
          });
          controller.enqueue(encoder.encode(`data: ${summary}\n\n`));
        } catch {
          controller.enqueue(
            encoder.encode(
              `data: {"type":"done","code":${code},"newSongs":[],"playlistId":"${playlist!.id}"}\n\n`,
            ),
          );
        }
        controller.close();
      });

      proc.on("error", (err) => {
        send(`[error] ${err.message}`);
        controller.enqueue(
          encoder.encode(
            `data: {"type":"done","code":-1,"newSongs":[],"playlistId":"${playlist!.id}"}\n\n`,
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
