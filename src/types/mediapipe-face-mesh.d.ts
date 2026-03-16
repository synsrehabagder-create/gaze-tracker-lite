declare module '@mediapipe/face_mesh' {
  export interface FaceMeshConfig {
    locateFile?: (file: string) => string;
  }
  export interface FaceMeshOptions {
    maxNumFaces?: number;
    refineLandmarks?: boolean;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
  }
  export interface NormalizedLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
  }
  export interface Results {
    multiFaceLandmarks: NormalizedLandmark[][];
  }
  export class FaceMesh {
    constructor(config?: FaceMeshConfig);
    setOptions(options: FaceMeshOptions): void;
    onResults(callback: (results: Results) => void): void;
    send(inputs: { image: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement }): Promise<void>;
    close(): Promise<void>;
    initialize(): Promise<void>;
  }
}
