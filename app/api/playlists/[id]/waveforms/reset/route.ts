import { getPlaylistById, resetWaveformsForPlaylist } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const playlist = getPlaylistById(id);
    if (!playlist) {
      return Response.json({ error: "Playlist not found" }, { status: 404 });
    }

    resetWaveformsForPlaylist(id);
    console.log(`[reset-waveforms] Cleared waveforms for playlist ${id}`);

    return Response.json({ success: true, message: "Waveforms reset" });
  } catch (err) {
    console.error("Reset waveforms error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
