declare module "music-tempo" {
  class MusicTempo {
    constructor(audioData: Float32Array);
    tempo: string;
    beats: number[];
  }
  export default MusicTempo;
}
