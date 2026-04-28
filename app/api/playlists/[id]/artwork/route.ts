import { NextRequest } from "next/server";
import { getPlaylistById, getSongsForPlaylist } from "@/lib/db";
import { parseFile } from "music-metadata";
import path from "path";
import fs from "fs";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/playlists/[id]/artwork">,
) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const songIdRaw = searchParams.get("songId");

  if (!songIdRaw) {
    return new Response("Missing songId", { status: 400 });
  }
  const songId = parseInt(songIdRaw, 10);
  if (isNaN(songId)) {
    return new Response("Invalid songId", { status: 400 });
  }

  const playlist = getPlaylistById(id);
  if (!playlist) {
    return new Response("Not found", { status: 404 });
  }

  const songs = getSongsForPlaylist(id);
  const song = songs.find((s) => s.id === songId);
  if (!song) {
    return new Response("Song not found", { status: 404 });
  }

  const filePath = path.join(playlist.folder, song.filename);
  if (!fs.existsSync(filePath)) {
    return new Response("File not found", { status: 404 });
  }

  try {
    const meta = await parseFile(filePath, { skipCovers: false });
    const picture = meta.common.picture?.[0];

    if (!picture) {
      return new Response("No artwork", { status: 404 });
    }

    return new Response(Buffer.from(picture.data), {
      headers: {
        "Content-Type": picture.format,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Failed to read metadata", { status: 500 });
  }
}
