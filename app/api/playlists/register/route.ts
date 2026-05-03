import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { getPlaylistByUrl, getOrCreatePlaylist } from "@/lib/db";

const DOWNLOADS_ROOT = path.join(process.cwd(), "downloads");

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.url !== "string") {
    return new Response(JSON.stringify({ error: "Missing url" }), {
      status: 400,
    });
  }

  const raw = body.url.trim();
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "Invalid URL" }), { status: 400 });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid URL" }), { status: 400 });
  }

  // Create playlist record if it doesn't exist, but do NOT start any download
  let playlist = getPlaylistByUrl(raw);
  if (!playlist) {
    const id = crypto.randomBytes(8).toString("hex");
    const folder = path.join(DOWNLOADS_ROOT, id);
    fs.mkdirSync(folder, { recursive: true });
    playlist = getOrCreatePlaylist(raw, folder, id);
  }

  return new Response(JSON.stringify({ success: true, playlistId: playlist.id }));
}
