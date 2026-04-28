import { NextRequest } from "next/server";
import {
  getPlaylistById,
  getSongsForPlaylist,
  updatePlaylist,
  deletePlaylist,
} from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/playlists/[id]">,
) {
  const { id } = await ctx.params;
  const playlist = getPlaylistById(id);
  if (!playlist) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const songs = getSongsForPlaylist(id);
  return Response.json({ ...playlist, songs });
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/playlists/[id]">,
) {
  const { id } = await ctx.params;
  const playlist = getPlaylistById(id);
  if (!playlist) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: { name?: string | null; url?: string } = {};

  if ("name" in body) {
    patch.name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : null;
  }

  if ("url" in body) {
    if (typeof body.url !== "string") {
      return Response.json({ error: "Invalid url" }, { status: 400 });
    }
    try {
      const parsed = new URL(body.url.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return Response.json({ error: "Invalid url" }, { status: 400 });
      }
      if (/[\x00-\x1f\x7f"'`\\;|&$<>(){}[\]!#]/.test(body.url.trim())) {
        return Response.json({ error: "Invalid url" }, { status: 400 });
      }
    } catch {
      return Response.json({ error: "Invalid url" }, { status: 400 });
    }
    patch.url = body.url.trim();
  }

  updatePlaylist(id, patch);
  return Response.json(getPlaylistById(id));
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/playlists/[id]">,
) {
  const { id } = await ctx.params;
  const playlist = getPlaylistById(id);
  if (!playlist) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  deletePlaylist(id);
  return Response.json({ ok: true });
}
