import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { handFrame, MuseumGestureController } from './hand-gestures.js';

const WASM_ROOT = '/vendor/mediapipe/wasm';
const MODEL_PATH = '/vendor/mediapipe/hand_landmarker.task';

/** Local-only webcam input for a BrowsEye workstation. No frame leaves the browser. */
export class HandTracking {
  constructor({ onOrbit, onZoom, onStatus, onError, onDevices, preview } = {}) {
    this.onStatus = onStatus || (() => {});
    this.onError = onError || (() => {});
    this.onDevices = onDevices || (() => {});
    this.preview = preview || null;
    this.controller = new MuseumGestureController({ onOrbit, onZoom, onStatus: this.onStatus });
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
    this.running = false;
    this.inference = false;
    this.lastFrameTime = -1;
    this.lastInferenceAt = 0;
    this.frame = 0;
    this.lifecycle = 0;
    this.starting = false;
  }

  async cameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(device => device.kind === 'videoinput');
    this.onDevices(cameras);
    return cameras;
  }

  async start(deviceId = '') {
    if (this.running || this.starting) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Diese Browser-Umgebung unterstützt keine Webcam-Freigabe.');
    this.starting = true;
    const lifecycle = ++this.lifecycle;
    this.onStatus('Webcam wird lokal vorbereitet …');
    const video = deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      if (lifecycle !== this.lifecycle) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      if (lifecycle !== this.lifecycle) { stream.getTracks().forEach(track => track.stop()); return; }
      if (this.preview) this.preview.srcObject = this.stream;
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      if (lifecycle !== this.lifecycle) return;
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: .65,
        minHandPresenceConfidence: .55,
        minTrackingConfidence: .6,
      });
      if (lifecycle !== this.lifecycle) { landmarker.close(); return; }
      this.landmarker = landmarker;
      this.running = true;
      this.lastFrameTime = -1;
      await this.cameras();
      this.onStatus('Bereit · Daumen und Zeigefinger zusammenführen, um zu greifen.');
      this.loop();
    } catch (error) {
      if (lifecycle !== this.lifecycle) return;
      this.stop('Webcam konnte nicht gestartet werden. Bitte Freigabe und USB-Kamera prüfen.');
      throw error;
    } finally {
      if (lifecycle === this.lifecycle) this.starting = false;
    }
  }

  loop() {
    if (!this.running) return;
    this.frame = requestAnimationFrame(() => this.loop());
    if (this.inference || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const now = performance.now();
    // 24 analyses per second keep the public display responsive while Three.js renders continuously.
    if (now - this.lastInferenceAt < 42 || this.video.currentTime === this.lastFrameTime) return;
    this.lastInferenceAt = now;
    this.lastFrameTime = this.video.currentTime;
    this.inference = true;
    try {
      const result = this.landmarker.detectForVideo(this.video, now);
      const hands = (result.landmarks || []).map((landmarks, index) => handFrame(landmarks, result.handedness?.[index]?.[0]?.categoryName, index)).filter(Boolean);
      this.controller.process(hands, now);
    } catch (error) {
      this.onError(`Handerkennung wurde angehalten: ${error.message}`);
      this.stop('Handerkennung angehalten.');
    } finally {
      this.inference = false;
    }
  }

  stop(message = 'Webcam ist aus · es werden keine Kamerabilder verarbeitet.') {
    this.lifecycle++;
    this.starting = false;
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.controller.release(message);
    try { this.landmarker?.close(); } catch {}
    this.landmarker = null;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    if (this.preview) this.preview.srcObject = null;
  }
}
