import { useCallback, useRef } from "react";
import { useMobileInput, requestMobileEmote, requestMobilePunch } from "../context/MobileInputContext";
import { RadialEmoteWheel } from "./RadialEmoteWheel";
import { FaHandFist } from "react-icons/fa6";

const JOYSTICK_RADIUS = 56;
const DEAD_ZONE = 0.12;

function clampKnob(dx: number, dy: number) {
  const dist = Math.hypot(dx, dy);
  if (dist <= JOYSTICK_RADIUS) return { dx, dy };
  const scale = JOYSTICK_RADIUS / dist;
  return { dx: dx * scale, dy: dy * scale };
}

function toAxis(dx: number, dy: number) {
  const nx = dx / JOYSTICK_RADIUS;
  const ny = -dy / JOYSTICK_RADIUS;
  const len = Math.hypot(nx, ny);
  if (len < DEAD_ZONE) return { moveX: 0, moveY: 0 };
  const scale = Math.min(1, len);
  return { moveX: (nx / len) * scale, moveY: (ny / len) * scale };
}

export function MobileControls() {
  const input = useMobileInput();
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const touchId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lastLookX = useRef(0);
  const center = useRef({ x: 0, y: 0 });

  const resetJoystick = useCallback(() => {
    if (!input) return;
    input.moveX = 0;
    input.moveY = 0;
    if (knobRef.current) {
      knobRef.current.style.transform = "translate(-50%, -50%)";
    }
  }, [input]);

  const updateJoystick = useCallback(
    (clientX: number, clientY: number) => {
      if (!input || !knobRef.current) return;
      const dx = clientX - center.current.x;
      const dy = clientY - center.current.y;
      const clamped = clampKnob(dx, dy);
      const axis = toAxis(clamped.dx, clamped.dy);
      input.moveX = axis.moveX;
      input.moveY = axis.moveY;
      knobRef.current.style.transform = `translate(calc(-50% + ${clamped.dx}px), calc(-50% + ${clamped.dy}px))`;
    },
    [input]
  );

  const onJoystickStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!joystickRef.current || touchId.current !== null) return;
    touchId.current = e.pointerId;
    joystickRef.current.setPointerCapture(e.pointerId);
    const rect = joystickRef.current.getBoundingClientRect();
    center.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateJoystick(e.clientX, e.clientY);
  };

  const onJoystickMove = (e: React.PointerEvent) => {
    if (e.pointerId !== touchId.current) return;
    e.stopPropagation();
    updateJoystick(e.clientX, e.clientY);
  };

  const onJoystickEnd = (e: React.PointerEvent) => {
    if (e.pointerId !== touchId.current) return;
    e.stopPropagation();
    touchId.current = null;
    resetJoystick();
  };

  const setJump = (pressed: boolean) => {
    if (!input) return;
    input.jump = pressed;
  };

  const onLookStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (lookId.current !== null || !input) return;
    lookId.current = e.pointerId;
    lastLookX.current = e.clientX;
    input.lookActive = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onLookMove = (e: React.PointerEvent) => {
    if (e.pointerId !== lookId.current || !input) return;
    e.stopPropagation();
    const dx = e.clientX - lastLookX.current;
    lastLookX.current = e.clientX;
    input.lookDeltaX += dx;
  };

  const onLookEnd = (e: React.PointerEvent) => {
    if (e.pointerId !== lookId.current || !input) return;
    e.stopPropagation();
    lookId.current = null;
    input.lookActive = false;
  };

  if (!input) return null;

  return (
    <div className="mobile-controls">
      <div
        className="look-zone"
        onPointerDown={onLookStart}
        onPointerMove={onLookMove}
        onPointerUp={onLookEnd}
        onPointerCancel={onLookEnd}
      />

      <div
        ref={joystickRef}
        className="joystick"
        onPointerDown={onJoystickStart}
        onPointerMove={onJoystickMove}
        onPointerUp={onJoystickEnd}
        onPointerCancel={onJoystickEnd}
      >
        <div ref={knobRef} className="joystick-knob" />
      </div>

      <div className="action-buttons">
        <button
          type="button"
          className="jump-btn"
          onPointerDown={(e) => {
            e.stopPropagation();
            setJump(true);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            setJump(false);
          }}
          onPointerLeave={() => setJump(false)}
          onPointerCancel={() => setJump(false)}
        >
          Jump
        </button>

        <button
          type="button"
          className="punch-btn"
          onPointerDown={(e) => {
            e.stopPropagation();
            requestMobilePunch(input);
          }}
        >
          <FaHandFist aria-hidden="true" />
          <span>Punch</span>
        </button>
      </div>

      <RadialEmoteWheel
        className="radial-emote-mobile"
        onSelect={(id) => requestMobileEmote(input, id)}
      />
    </div>
  );
}
