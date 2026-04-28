import { NextRequest } from "next/server";
import { getPlaylistById, getSongsForPlaylist } from "@/lib/db";
import { parseFile } from "music-metadata";
import path from "path";
import fs from "fs";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/playlists/[id]/songs">,
) {
  const { id } = await ctx.params;
  const playlist = getPlaylistById(id);
  if (!playlist) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const songs = getSongsForPlaylist(id);

  const enriched = await Promise.all(
    songs.map(async (song) => {
      const filePath = path.join(playlist.folder, song.filename);

      let size: number | null = null;
      let title: string | null = null;
      let artist: string | null = null;
      let album: string | null = null;
      let duration: number | null = null;
      let exists = false;

      try {
        const stat = fs.statSync(filePath);
        size = stat.size;
        exists = true;
      } catch {
        // file missing
      }

      let hasArtwork = false;

      if (exists) {
        try {
          const meta = await parseFile(filePath, {
            duration: true,
            skipCovers: false,
          });
          title = meta.common.title ?? null;
          artist =
            meta.common.artist ??
            (meta.common.artists ? meta.common.artists[0] : null) ??
            null;
          album = meta.common.album ?? null;
          duration = meta.format.duration ?? null;
          hasArtwork = (meta.common.picture?.length ?? 0) > 0;
        } catch {
          // metadata unreadable – still return filename
        }
      }

      return {
        ...song,
        exists,
        size,
        title,
        artist,
        album,
        duration,
        hasArtwork,
      };
    }),
  );

  return Response.json(enriched);
}
