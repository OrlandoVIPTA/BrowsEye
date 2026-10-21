const finitePoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
const distance2d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Converts MediaPipe's 21 landmarks into the deliberately small gesture model
 * used by BrowsEye. The ratio keeps pinch detection usable at different visitor
 * distances from a normal USB webcam.
 */
export function handFrame(landmarks, handedness = 'Hand', index = 0) {
  if (!Array.isArray(landmarks) || landmarks.length < 10 || ![0, 4, 8, 9].every(i => finitePoint(landmarks[i]))) return null;
  const palm = Math.max(.0001, distance2d(landmarks[0], landmarks[9]));
  const pinch = distance2d(landmarks[4], landmarks[8]) / palm;
  const center = {
    x: (landmarks[0].x + landmarks[9].x) / 2,
    y: (landmarks[0].y + landmarks[9].y) / 2,
  };
  return {
    id: `${handedness || 'Hand'}:${index}`,
    handedness: handedness || 'Hand',
    x: center.x,
    y: center.y,
    palm,
    pinched: pinch < .48,
    pinch,
  };
}

const sameHand = (candidate, owner) => candidate && owner && candidate.handedness === owner.handedness;

/**
 * Gesture state is intentionally conservative for a public exhibit:
 * - nothing moves until a visitor holds a pinch briefly;
 * - releasing the pinch always lets go immediately;
 * - only the hand(s) that activated the session are used afterwards.
 */
export class MuseumGestureController {
  constructor({ onOrbit = () => {}, onZoom = () => {}, onStatus = () => {} } = {}) {
    this.onOrbit = onOrbit;
    this.onZoom = onZoom;
    this.onStatus = onStatus;
    this.mode = 'idle';
    this.pending = null;
    this.owner = null;
    this.last = null;
    this.lastSeenAt = 0;
    this.status = '';
  }

  setStatus(message) {
    if (message === this.status) return;
    this.status = message;
    this.onStatus(message, this.mode);
  }

  release(message = 'Losgelassen · Maus, Touch und eine neue Geste sind bereit.') {
    this.mode = 'idle';
    this.pending = null;
    this.owner = null;
    this.last = null;
    this.reacquire = false;
    this.setStatus(message);
  }

  choosePinched(hands) {
    return hands.filter(hand => hand?.pinched).sort((a, b) => b.palm - a.palm);
  }

  begin(pinched, now) {
    const pair = pinched.length > 1 && pinched[0].handedness !== pinched[1].handedness;
    this.mode = pair ? 'zoom' : 'orbit';
    this.owner = (pair ? pinched.slice(0, 2) : [pinched[0]]).map(hand => ({ handedness: hand.handedness, x: hand.x, y: hand.y }));
    this.last = pair
      ? distance2d(pinched[0], pinched[1])
      : { x: pinched[0].x, y: pinched[0].y };
    this.lastSeenAt = now;
    this.setStatus(pair ? 'Zwei Hände greifen · Abstand ändern zum Zoomen.' : 'Greifen · Hand bewegen zum Drehen. Loslassen beendet die Steuerung.');
  }

  ownerHands(pinched) {
    if (!this.owner?.length) return [];
    this.ambiguous = false;
    const available = [...pinched];
    return this.owner.map(owner => {
      const candidates = available.map((hand, index) => ({ hand, index, distance: sameHand(hand, owner) ? distance2d(hand, owner) : Infinity }))
        .filter(candidate => Number.isFinite(candidate.distance)).sort((a, b) => a.distance - b.distance);
      // Handedness by itself is not a visitor identity. Releasing is safer than
      // transferring control to a second, similarly labelled hand nearby.
      if (!candidates.length || candidates[0].distance > .22) return null;
      if (candidates[1] && candidates[1].distance - candidates[0].distance < .025) { this.ambiguous = true; return null; }
      return available.splice(candidates[0].index, 1)[0];
    }).filter(Boolean);
  }

  process(hands, now = performance.now()) {
    const visibleHands = (hands || []).filter(Boolean);
    const pinched = this.choosePinched(visibleHands);
    if (!visibleHands.length) {
      this.pending = null;
      if (this.mode === 'idle') { this.setStatus('Hand vor die Kamera halten und dann greifen.'); return; }
      this.reacquire = true;
      if (now - this.lastSeenAt > 480) this.release('Hand verloren · Ansicht bleibt stehen.');
      else this.setStatus('Hand verloren · Bewegungen sind angehalten.');
      return;
    }
    if (!pinched.length) {
      if (this.mode !== 'idle') this.release('Losgelassen · Ansicht bleibt stehen.');
      else { this.pending = null; this.setStatus('Daumen und Zeigefinger zusammenführen, um das Objekt zu greifen.'); }
      return;
    }

    if (this.mode === 'idle') {
      const key = pinched.length > 1 ? `${pinched[0].handedness}+${pinched[1].handedness}` : pinched[0].handedness;
      if (!this.pending || this.pending.key !== key || distance2d(pinched[0], this.pending) > .12) {
        this.pending = { key, since: now, x: pinched[0].x, y: pinched[0].y };
        this.setStatus('Geste erkannt · kurz halten, um die Steuerung zu übernehmen.');
        return;
      }
      if (now - this.pending.since < 240) return;
      this.begin(pinched, now);
      return;
    }

    const owned = this.ownerHands(pinched);
    if (owned.length !== this.owner.length) {
      if (this.ambiguous) { this.release('Mehrdeutige Handerkennung · bitte erneut bewusst greifen.'); return; }
      this.reacquire = true;
      if (now - this.lastSeenAt > 480) this.release('Hand verloren · Ansicht bleibt stehen.');
      else this.setStatus('Hand wird gesucht · Bewegungen sind angehalten.');
      return;
    }
    this.lastSeenAt = now;

    if (this.reacquire) {
      this.last = this.mode === 'zoom' ? distance2d(owned[0], owned[1]) : { x: owned[0].x, y: owned[0].y };
      this.owner.forEach((owner, index) => Object.assign(owner, { x: owned[index].x, y: owned[index].y }));
      this.reacquire = false;
      this.setStatus('Hand wiedergefunden · Steuerung fortsetzen.');
      return;
    }

    if (this.mode === 'orbit') {
      const hand = owned[0];
      const dx = clamp(hand.x - this.last.x, -.12, .12);
      const dy = clamp(hand.y - this.last.y, -.12, .12);
      this.last = { x: hand.x, y: hand.y };
      Object.assign(this.owner[0], { x: hand.x, y: hand.y });
      if (Math.abs(dx) + Math.abs(dy) > .003) this.onOrbit({ dx, dy });
      return;
    }

    const spacing = Math.max(.0001, distance2d(owned[0], owned[1]));
    const delta = clamp(Math.log(spacing / this.last), -.12, .12);
    this.last = spacing;
    this.owner.forEach((owner, index) => Object.assign(owner, { x: owned[index].x, y: owned[index].y }));
    if (Math.abs(delta) > .006) this.onZoom({ delta });
  }
}
