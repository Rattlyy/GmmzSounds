import { getSongsForPlaylist, setAnalysis } from "@/lib/db";
import { analyzeAudio } from "@/lib/analyze";
import path from "path";
import fs from "fs";
import { getPlaylistById } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; songId: string }> }
) {
  const { id, songId } = await params;
  const parsedSongId = parseInt(songId, 10);

  try {
    const playlist = getPlaylistById(id);
    if (!playlist) {
      return Response.json({ error: "Playlist not found" }, { status: 404 });
    }

    const songs = getSongsForPlaylist(id);
    const song = songs.find((s) => s.id === parsedSongId);
    if (!song) {
      return Response.json({ error: "Song not found" }, { status: 404 });
    }

    const filePath = path.join(playlist.folder, song.filename);
    if (!fs.existsSync(filePath)) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    // Generate waveform
    const result = await analyzeAudio(filePath, 120);
    
    // Store to DB
    try {
      setAnalysis(parsedSongId, result.bpm, JSON.stringify(result.waveform));
      console.log(`[analyze] Stored analysis for song ${parsedSongId}: BPM=${result.bpm}, waveform bins=${result.waveform.length}`);
    } catch (dbErr) {
      console.error(`[analyze] Failed to store analysis for song ${parsedSongId}:`, dbErr);
      throw dbErr;
    }

    return Response.json({
      bpm: result.bpm,
      waveform: result.waveform,
    });
  } catch (err) {
    console.error("Analyze error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
