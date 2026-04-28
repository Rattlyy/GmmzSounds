import { NextRequest } from "next/server";
import { getPlaylistById, getSongsForPlaylist, deleteSong } from "@/lib/db";
import path from "path";
import fs from "fs";
import { PassThrough } from "stream";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/playlists/[id]/songs/[songId]">,
) {
  const { id, songId } = await ctx.params;

  const playlist = getPlaylistById(id);
  if (!playlist) {
    return Response.json({ error: "Playlist not found" }, { status: 404 });
  }

  const song = getSongsForPlaylist(id).find((s) => s.id === parseInt(songId, 10));
  if (!song) {
    return Response.json({ error: "Song not found" }, { status: 404 });
  }

  // Delete file from disk — ignore error if already missing
  try {
    fs.unlinkSync(path.join(playlist.folder, song.filename));
  } catch {
    // file may already be gone, that's fine
  }

  deleteSong(song.id);

  return Response.json({ ok: true });
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/playlists/[id]/songs/[songId]">,
) {
  const { id, songId } = await ctx.params;

  const playlist = getPlaylistById(id);
  if (!playlist) {
    return Response.json({ error: "Playlist not found" }, { status: 404 });
  }

  const song = getSongsForPlaylist(id).find((s) => s.id === parseInt(songId, 10));
  if (!song) {
    return Response.json({ error: "Song not found" }, { status: 404 });
  }

  const filePath = path.join(playlist.folder, song.filename);

  if (!fs.existsSync(filePath)) {
    return Response.json({ error: "File not found on disk" }, { status: 404 });
  }

  // Pipe the file read stream through a PassThrough into a Web ReadableStream
  const pass = new PassThrough();
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(pass);

  const webStream = new ReadableStream({
    start(controller) {
      pass.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      pass.on("end", () => controller.close());
      pass.on("error", (err) => controller.error(err));
    },
    cancel() {
      fileStream.destroy();
    },
  });

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${song.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
