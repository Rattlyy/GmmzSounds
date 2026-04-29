declare module "music-tempo" {
  export class MusicTempo {
    constructor(audioData: Float32Array);
    tempo: string;
    beats: number[];
  }
}
