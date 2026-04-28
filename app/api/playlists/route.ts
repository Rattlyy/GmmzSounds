import { getAllPlaylists, getSongsForPlaylist } from "@/lib/db";

export async function GET() {
  const playlists = getAllPlaylists();
  const result = playlists.map((p) => ({
    ...p,
    songCount: getSongsForPlaylist(p.id).length,
  }));
  return Response.json(result);
}
