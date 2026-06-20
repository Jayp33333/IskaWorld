import { useCallback, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Room } from "colyseus.js";
import * as THREE from "three";
import { Avatar, playEmote, playPunch, useCharacterAnimState } from "./Avatar";
import { useKeyboard } from "../hooks/useKeyboard";
import { useIsMobile } from "../hooks/useIsMobile";
import { useMobileInput } from "../context/MobileInputContext";
import { collidesAt } from "../world/obstacles";
import { EMOTE_BY_KEY } from "../character/emotes";

const SPEED = 6; // units per second — raise/lower with ANIM_PLAYBACK.walk in CharacterModel.tsx
const SEND_INTERVAL = 1 / 15; // send ~15 updates/sec
const GRAVITY = -25; // units per second^2
const JUMP_SPEED = 9; // initial upward velocity — air time ≈ 2 * JUMP_SPEED / |GRAVITY|
const PLAYER_RADIUS = 0.35;

const CAM_DISTANCE = 9; // how far the camera sits behind the player
const CAM_HEIGHT = 6; // how high the camera floats
const KEY_ROT_SPEED = 2.2; // radians/sec for Q/E
const MOUSE_SENSITIVITY = 0.005; // radians per pixel dragged
const MOBILE_LOOK_SENSITIVITY = 0.004;
const MOBILE_YAW_SMOOTH_IDLE = 3.5; // lower = smoother when standing still
const MOBILE_YAW_SMOOTH_MOVE = 14; // snappier while walking

const PP_MIN_DIST = 1.0; // players closer than this overlap (soft separation only)
const PUNCH_RANGE = 1.45;
const PUNCH_ANGLE = 0.45; // how directly in front a target must be
const PUNCH_COOLDOWN = 0.55;
const PUNCH_KNOCKBACK = 9;
const KNOCKBACK_DECAY = 0.12; // smaller = knockback dies faster

interface Props {
  room: Room;
  name: string;
  color: string;
}

// The player you control. Moves locally for instant feedback, then reports
// its transform to the server, which broadcasts it to everyone else.
export function LocalPlayer({ room, name, color }: Props) {
  const group = useRef<THREE.Group>(null);
  const keys = useKeyboard();
  const mobileInput = useMobileInput();
  const isMobile = useIsMobile();
  const { camera, gl } = useThree();

  const rotation = useRef(0);
  const sendTimer = useRef(0);
  const camTarget = useRef(new THREE.Vector3());
  const velocityY = useRef(0);
  const grounded = useRef(true);

  // Camera orbit angle (yaw) around the player.
  const camYaw = useRef(0);
  const camYawTarget = useRef(0);
  const pointerLocked = useRef(false);

  // Knockback velocity from being shoved by other players.
  const knockX = useRef(0);
  const knockZ = useRef(0);
  const punchCooldown = useRef(0);
  const animState = useCharacterAnimState();
  const lastMobileEmoteSeq = useRef(0);
  const lastMobilePunchSeq = useRef(0);
  const lockHintEl = useRef<HTMLDivElement | null>(null);

  // Start at the server-assigned spawn point (same as other clients see you).
  useEffect(() => {
    const self = (room.state.players as any).get(room.sessionId);
    const g = group.current;
    if (!self || !g) return;
    g.position.set(self.x, self.y, self.z);
    rotation.current = self.rotation;
    g.rotation.y = self.rotation;
  }, [room]);

  // Receive shove impulses relayed by the server and turn them into knockback.
  useEffect(() => {
    const handler = (msg: { dx: number; dz: number }) => {
      knockX.current += msg.dx * PUNCH_KNOCKBACK;
      knockZ.current += msg.dz * PUNCH_KNOCKBACK;
    };
    room.onMessage("shoved", handler);
    // colyseus.js keeps one handler per message type, so no manual cleanup.
  }, [room]);

  const tryPunch = useCallback(() => {
    if (punchCooldown.current > 0) return;
    const g = group.current;
    if (!g) return;

    punchCooldown.current = PUNCH_COOLDOWN;
    playPunch(room, animState);

    // Punch toward where the camera is looking (desktop) / last facing (mobile).
    const facingX = -Math.sin(camYaw.current);
    const facingZ = -Math.cos(camYaw.current);
    g.rotation.y = Math.atan2(facingX, facingZ);
    rotation.current = g.rotation.y;

    (room.state.players as any).forEach((p: any, id: string) => {
      if (id === room.sessionId) return;

      const ox = p.x - g.position.x;
      const oz = p.z - g.position.z;
      const dist = Math.hypot(ox, oz);
      if (dist > PUNCH_RANGE || dist < 0.0001) return;

      const nx = ox / dist;
      const nz = oz / dist;
      const inFront = nx * facingX + nz * facingZ;
      if (inFront < PUNCH_ANGLE) return;

      room.send("shove", { target: id, dx: nx, dz: nz });
    });
  }, [room, animState]);

  // Desktop: pointer lock for camera look, left click to punch.
  useEffect(() => {
    if (isMobile) return;

    const canvas = gl.domElement;

    if (!lockHintEl.current) {
      const hint = document.createElement("div");
      hint.className = "pointer-lock-hint";
      hint.textContent =
        "Click the game to lock mouse · Move mouse to look · Left click punch · Esc unlock";
      document.body.appendChild(hint);
      lockHintEl.current = hint;
    }

    const syncLockState = () => {
      const locked = document.pointerLockElement === canvas;
      pointerLocked.current = locked;
      if (lockHintEl.current) {
        lockHintEl.current.style.display = locked ? "none" : "block";
      }
    };

    const requestLock = () => {
      if (!canvas.isConnected) return;
      void canvas.requestPointerLock().catch(() => {});
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();

      if (document.pointerLockElement !== canvas) {
        requestLock();
        return;
      }

      tryPunch();
    };

    const onMove = (e: PointerEvent) => {
      if (document.pointerLockElement !== canvas) return;
      camYaw.current -= e.movementX * MOUSE_SENSITIVITY;
      camYawTarget.current = camYaw.current;
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove);
    canvas.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("pointerlockchange", syncLockState);

    syncLockState();
    requestAnimationFrame(requestLock);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerlockchange", syncLockState);
      lockHintEl.current?.remove();
      lockHintEl.current = null;
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
  }, [gl, isMobile, tryPunch]);

  // Desktop: number keys trigger emotes (punch excluded).
  useEffect(() => {
    if (isMobile) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const emoteId = EMOTE_BY_KEY[e.code];
      if (!emoteId) return;
      e.preventDefault();
      playEmote(room, animState, emoteId);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, animState, room]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const k = keys.current;

    // Rotate the camera with Q / E (desktop).
    if (k["KeyQ"]) {
      camYaw.current += KEY_ROT_SPEED * delta;
      camYawTarget.current = camYaw.current;
    }
    if (k["KeyE"]) {
      camYaw.current -= KEY_ROT_SPEED * delta;
      camYawTarget.current = camYaw.current;
    }

    let inF = 0;
    let inR = 0;
    if (k["KeyW"] || k["ArrowUp"]) inF += 1;
    if (k["KeyS"] || k["ArrowDown"]) inF -= 1;
    if (k["KeyD"] || k["ArrowRight"]) inR += 1;
    if (k["KeyA"] || k["ArrowLeft"]) inR -= 1;

    if (isMobile && mobileInput) {
      inF += mobileInput.moveY;
      inR += mobileInput.moveX;
    }

    if (mobileInput && mobileInput.emoteSeq !== lastMobileEmoteSeq.current && mobileInput.emoteId) {
      lastMobileEmoteSeq.current = mobileInput.emoteSeq;
      playEmote(room, animState, mobileInput.emoteId);
    }

    if (mobileInput && mobileInput.punchSeq !== lastMobilePunchSeq.current) {
      lastMobilePunchSeq.current = mobileInput.punchSeq;
      tryPunch();
    }

    punchCooldown.current = Math.max(0, punchCooldown.current - delta);

    const isMoving = Math.hypot(inF, inR) > 0.05;
    animState.current.isMoving = isMoving;
    animState.current.isGrounded = grounded.current;

    // Mobile touch look: update target yaw, then ease the camera toward it.
    if (isMobile && mobileInput) {
      if (mobileInput.lookDeltaX !== 0) {
        camYawTarget.current -=
          mobileInput.lookDeltaX * MOBILE_LOOK_SENSITIVITY;
        mobileInput.lookDeltaX = 0;
      }

      const smooth = isMoving
        ? MOBILE_YAW_SMOOTH_MOVE
        : MOBILE_YAW_SMOOTH_IDLE;
      const t = 1 - Math.exp(-smooth * delta);
      camYaw.current += (camYawTarget.current - camYaw.current) * t;
    }

    // Camera-relative movement axes (so "forward" follows where you look).
    const yaw = camYaw.current;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    let dx = forwardX * inF + rightX * inR;
    let dz = forwardZ * inF + rightZ * inR;

    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;

      // Move + collide per-axis so the player slides along walls.
      const nx = g.position.x + dx * SPEED * delta;
      if (!collidesAt(nx, g.position.z, PLAYER_RADIUS)) g.position.x = nx;
      const nz = g.position.z + dz * SPEED * delta;
      if (!collidesAt(g.position.x, nz, PLAYER_RADIUS)) g.position.z = nz;

      rotation.current = Math.atan2(dx, dz);
      g.rotation.y = rotation.current;
    }

    // Jump + gravity (vertical motion).
    const wantsJump =
      k["Space"] ||
      k["KeyJ"] ||
      (isMobile && mobileInput?.jump);
    if (wantsJump && grounded.current) {
      velocityY.current = JUMP_SPEED;
      grounded.current = false;
    }
    velocityY.current += GRAVITY * delta;
    g.position.y += velocityY.current * delta;
    if (g.position.y <= 0) {
      g.position.y = 0;
      velocityY.current = 0;
      grounded.current = true;
    }

    // Apply incoming knockback (then let it decay).
    if (knockX.current !== 0 || knockZ.current !== 0) {
      const kx = g.position.x + knockX.current * delta;
      if (!collidesAt(kx, g.position.z, PLAYER_RADIUS)) g.position.x = kx;
      const kz = g.position.z + knockZ.current * delta;
      if (!collidesAt(g.position.x, kz, PLAYER_RADIUS)) g.position.z = kz;

      const decay = Math.exp(-delta / KNOCKBACK_DECAY);
      knockX.current *= decay;
      knockZ.current *= decay;
      if (Math.hypot(knockX.current, knockZ.current) < 0.05) {
        knockX.current = 0;
        knockZ.current = 0;
      }
    }

    // Soft overlap separation only — no knockback unless punched.
    (room.state.players as any).forEach((p: any, id: string) => {
      if (id === room.sessionId) return;
      const ox = g.position.x - p.x;
      const oz = g.position.z - p.z;
      const d = Math.hypot(ox, oz);
      if (d > 0.0001 && d < PP_MIN_DIST) {
        const nx = ox / d;
        const nz = oz / d;
        const overlap = PP_MIN_DIST - d;

        const sx = g.position.x + nx * overlap * 0.5;
        if (!collidesAt(sx, g.position.z, PLAYER_RADIUS)) g.position.x = sx;
        const sz = g.position.z + nz * overlap * 0.5;
        if (!collidesAt(g.position.x, sz, PLAYER_RADIUS)) g.position.z = sz;
      }
    });

    // Orbiting third-person camera that trails the player at camYaw.
    const desired = camTarget.current.set(
      g.position.x + Math.sin(yaw) * CAM_DISTANCE,
      g.position.y + CAM_HEIGHT,
      g.position.z + Math.cos(yaw) * CAM_DISTANCE
    );
    camera.position.lerp(desired, 1 - Math.pow(0.001, delta));
    camera.lookAt(g.position.x, g.position.y + 1, g.position.z);

    // Throttle network updates.
    sendTimer.current += delta;
    if (sendTimer.current >= SEND_INTERVAL) {
      sendTimer.current = 0;
      room.send("move", {
        x: g.position.x,
        y: g.position.y,
        z: g.position.z,
        rotation: rotation.current,
        moving: isMoving,
      });
    }
  });

  return (
    <group ref={group}>
      <Avatar color={color} name={name} animState={animState} />
    </group>
  );
}
