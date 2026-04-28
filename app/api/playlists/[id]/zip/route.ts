import { NextRequest } from "next/server";
import { getPlaylistById, getSongsForPlaylist } from "@/lib/db";
import archiver from "archiver";
import { parseFile } from "music-metadata";
import path from "path";
import fs from "fs";
import { PassThrough } from "stream";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/playlists/[id]/zip">,
) {
  const { id } = await ctx.params;
  const playlist = getPlaylistById(id);
  if (!playlist) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  // ?since=<unix_seconds> — include only songs added after this timestamp
  const sinceRaw = searchParams.get("since");
  const since = sinceRaw ? parseInt(sinceRaw, 10) : null;

  const songs = getSongsForPlaylist(id).filter((s) => {
    if (since !== null && !isNaN(since)) return s.added_at > since;
    return true;
  });

  const existing = songs.filter((s) =>
    fs.existsSync(path.join(playlist.folder, s.filename)),
  );

  const filtered = (
    await Promise.all(
      existing.map(async (s) => {
        try {
          const meta = await parseFile(path.join(playlist.folder, s.filename), {
            duration: true,
            skipCovers: true,
          });
          const dur = meta.format.duration ?? null;
          if (dur !== null && dur < 30) return null;
        } catch {
          /* include if unreadable */
        }
        return s;
      }),
    )
  ).filter((s): s is NonNullable<typeof s> => s !== null);

  if (filtered.length === 0) {
    return Response.json({ error: "No valid files to zip" }, { status: 404 });
  }

  const label = playlist.name ?? playlist.id;
  const zipName = `${label.replace(/[^a-z0-9_-]/gi, "_")}${since ? "_new" : ""}.zip`;

  // Pipe archiver through a PassThrough into a ReadableStream
  const pass = new PassThrough();

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(pass);

  for (const song of filtered) {
    archive.file(path.join(playlist.folder, song.filename), {
      name: song.filename,
    });
  }

  archive.finalize();

  // Convert Node PassThrough to Web ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      pass.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      pass.on("end", () => controller.close());
      pass.on("error", (err) => controller.error(err));
    },
  });

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "no-store",
    },
  });
}
