/**
 * Small, browser-native input helpers shared by the walk-through viewer.
 * Values are deliberately vendor-neutral: Xbox, PlayStation and generic HID
 * pads are exposed through the browser's standard Gamepad mapping when the
 * operating system recognises them.
 */
export function applyDeadzone(value, threshold = .16) {
  const number = Number(value) || 0;
  const limit = Math.min(.95, Math.max(0, Number(threshold) || 0));
  const magnitude = Math.abs(number);
  if (magnitude <= limit) return 0;
  // Preserve the full usable stick range after removing stick drift.
  return Math.sign(number) * Math.min(1, (magnitude - limit) / (1 - limit));
}

const buttonValue = (buttons, index) => {
  const button = buttons?.[index];
  return typeof button === 'number' ? button : Number(button?.value || 0);
};

/**
 * Normalises a W3C Gamepad object into navigation intentions. It does not
 * depend on a manufacturer SDK and is safe to call with absent/partial pads.
 */
export function gamepadNavigationFrame(gamepad, { deadzone = .16 } = {}) {
  if (!gamepad?.connected) return { connected: false, moveX: 0, forward: 0, lookX: 0, lookY: 0, rise: 0, sprint: false };
  const axes = gamepad.axes || [];
  const leftX = applyDeadzone(axes[0], deadzone);
  const leftY = applyDeadzone(axes[1], deadzone);
  const rightX = applyDeadzone(axes[2], deadzone);
  const rightY = applyDeadzone(axes[3], deadzone);
  // The standard mapping reports a pushed-up stick as a negative Y value.
  const rise = applyDeadzone(buttonValue(gamepad.buttons, 7) - buttonValue(gamepad.buttons, 6), deadzone);
  return {
    connected: true,
    moveX: leftX,
    forward: -leftY,
    lookX: rightX,
    lookY: rightY,
    rise,
    sprint: buttonValue(gamepad.buttons, 0) > .5 || buttonValue(gamepad.buttons, 5) > .5,
  };
}

/** Returns a frame-rate-independent local movement vector. */
export function movementIntent({ moveX = 0, forward = 0, rise = 0 } = {}, { speed = 1, deltaSeconds = 0, fly = false } = {}) {
  const horizontal = Math.hypot(moveX, forward);
  const scale = horizontal > 1 ? 1 / horizontal : 1;
  return {
    right: moveX * scale * speed * deltaSeconds,
    forward: forward * scale * speed * deltaSeconds,
    up: fly ? rise * speed * deltaSeconds : 0,
  };
}
