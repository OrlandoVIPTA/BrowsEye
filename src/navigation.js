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

const combineAxis = (stick, buttonAxis) => Math.abs(stick) > .001 ? stick : buttonAxis;

const calibratedAxis = (axes, binding, fallbackIndex, deadzone) => {
  const index = Number.isInteger(binding?.index) ? binding.index : fallbackIndex;
  const neutral = Number.isFinite(binding?.neutral) ? binding.neutral : 0;
  const sign = binding?.sign < 0 ? -1 : 1;
  return applyDeadzone(((Number(axes[index]) || 0) - neutral) * sign, deadzone);
};

/**
 * Some Windows drivers expose an otherwise normal Xbox pad through the older
 * DirectInput layout: axis 2 is then the combined LT/RT axis and the right
 * stick lives on axes 3/4.  Detect that neutral trigger axis once at connect
 * time, before a held trigger can be mistaken for looking around.
 */
export function detectGamepadProfile(gamepad) {
  const axes = gamepad?.axes || [];
  const thirdAxis = Number(axes[2]) || 0;
  return axes.length >= 5 && Math.abs(thirdAxis) >= .96 ? 'legacy-trigger-axis' : 'standard';
}

/**
 * Normalises a W3C Gamepad object into navigation intentions. It does not
 * depend on a manufacturer SDK and is safe to call with absent/partial pads.
 */
export function gamepadNavigationFrame(gamepad, { deadzone = .16, profile = 'standard', calibration = null } = {}) {
  if (!gamepad?.connected) return { connected: false, moveX: 0, forward: 0, lookX: 0, lookY: 0, rise: 0, sprint: false };
  const axes = gamepad.axes || [];
  const leftX = applyDeadzone(axes[0], deadzone);
  const leftY = applyDeadzone(axes[1], deadzone);
  // In the legacy profile the trigger axis must never become a look axis.
  const rightX = calibratedAxis(axes, calibration?.lookX, profile === 'legacy-trigger-axis' ? 3 : 2, deadzone);
  const rightY = calibratedAxis(axes, calibration?.lookY, profile === 'legacy-trigger-axis' ? 4 : 3, deadzone);
  // D-pad remains useful for accessibility and controllers whose left stick
  // is worn or temporarily unavailable. Standard mapping: 12/13/14/15 are
  // up/down/left/right.
  const dpadX = buttonValue(gamepad.buttons, 15) - buttonValue(gamepad.buttons, 14);
  const dpadForward = buttonValue(gamepad.buttons, 12) - buttonValue(gamepad.buttons, 13);
  // The standard mapping reports a pushed-up stick as a negative Y value.
  const rise = applyDeadzone(buttonValue(gamepad.buttons, 7) - buttonValue(gamepad.buttons, 6), deadzone);
  return {
    connected: true,
    moveX: combineAxis(leftX, dpadX),
    forward: combineAxis(-leftY, dpadForward),
    lookX: rightX,
    lookY: rightY,
    rise,
    // A / Cross, right bumper or pressing the left stick: all intuitive
    // sprint affordances on Xbox, PlayStation and many generic controllers.
    sprint: buttonValue(gamepad.buttons, 0) > .5 || buttonValue(gamepad.buttons, 5) > .5 || buttonValue(gamepad.buttons, 10) > .5,
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
