import {
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { EMOTES, type EmoteId } from "../character/emotes";

export const CHARACTER_MODEL_URL = "/models/character.glb";
const MODEL_SCALE = 0.3;

export const CLIPS = {
  idle: "Man_Idle",
  walk: "Man_Walk",
  jump: "Man_Jump",
  runningJump: "Man_RunningJump",
} as const;

export const ANIM_PLAYBACK = {
  idle: 1,
  walk: 1.15,
  jump: 1.7,
  runningJump: 1.25,
  emote: 1,
} as const;

export type CharacterAnimState = {
  isMoving: boolean;
  isGrounded: boolean;
  emoteSeq: number;
  emoteId: EmoteId | null;
};

function playbackForClip(clipName: string): number {
  switch (clipName) {
    case CLIPS.walk:
      return ANIM_PLAYBACK.walk;
    case CLIPS.jump:
      return ANIM_PLAYBACK.jump;
    case CLIPS.runningJump:
      return ANIM_PLAYBACK.runningJump;
    default:
      if (Object.values(EMOTES).some((e) => e.clip === clipName)) {
        return ANIM_PLAYBACK.emote;
      }
      return ANIM_PLAYBACK.idle;
  }
}

function playLocomotionClip(action: THREE.AnimationAction, clipName: string) {
  action.reset();
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.clampWhenFinished = false;
  action.setEffectiveTimeScale(playbackForClip(clipName));
  action.fadeIn(0.2).play();
}

function pickLocomotionClip({ isMoving, isGrounded }: CharacterAnimState): string {
  if (!isGrounded) {
    return isMoving ? CLIPS.runningJump : CLIPS.jump;
  }
  return isMoving ? CLIPS.walk : CLIPS.idle;
}

function applyPlayerTint(root: THREE.Object3D, color: string) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;

    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    const clonedMats = mats.map((mat) => {
      const cloned = mat.clone();
      if ("emissive" in cloned) {
        cloned.emissive = new THREE.Color(color);
        cloned.emissiveIntensity = 0.08;
      }
      return cloned;
    });
    child.material = clonedMats.length === 1 ? clonedMats[0] : clonedMats;
  });
}

interface Props {
  color: string;
  animState: MutableRefObject<CharacterAnimState>;
}

export function CharacterModel({ color, animState }: Props) {
  const group = useRef<THREE.Group>(null);
  const currentClip = useRef<string | null>(null);
  const lastEmoteSeq = useRef(0);
  const emoteMode = useRef<"none" | "playing" | "held">("none");
  const activeEmoteId = useRef<EmoteId | null>(null);
  const finishHandler = useRef<((e: { action: THREE.AnimationAction }) => void) | null>(
    null
  );

  const { scene, animations } = useGLTF(CHARACTER_MODEL_URL);
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions, mixer } = useAnimations(animations, group);

  const fadeOutCurrent = () => {
    if (!currentClip.current) return;
    actions[currentClip.current]?.fadeOut(0.15);
    currentClip.current = null;
  };

  const clearEmote = () => {
    if (finishHandler.current) {
      mixer.removeEventListener("finished", finishHandler.current);
      finishHandler.current = null;
    }
    emoteMode.current = "none";
    activeEmoteId.current = null;
    fadeOutCurrent();
  };

  const playEmote = (id: EmoteId) => {
    const def = EMOTES[id];
    const action = actions[def.clip];
    if (!action) return;

    if (finishHandler.current) {
      mixer.removeEventListener("finished", finishHandler.current);
      finishHandler.current = null;
    }

    fadeOutCurrent();

    action.reset();
    action.setLoop(
      def.loop ? THREE.LoopRepeat : THREE.LoopOnce,
      def.loop ? Infinity : 1
    );
    action.clampWhenFinished = def.holdLastFrame;
    action.setEffectiveTimeScale(ANIM_PLAYBACK.emote);
    action.fadeIn(0.15).play();

    currentClip.current = def.clip;
    activeEmoteId.current = id;
    emoteMode.current = "playing";

    if (!def.loop) {
      const onFinished = (e: { action: THREE.AnimationAction }) => {
        if (e.action !== action) return;
        mixer.removeEventListener("finished", onFinished);
        finishHandler.current = null;

        if (def.holdLastFrame) {
          emoteMode.current = "held";
        } else {
          emoteMode.current = "none";
          activeEmoteId.current = null;
          currentClip.current = null;
        }
      };
      finishHandler.current = onFinished;
      mixer.addEventListener("finished", onFinished);
    }
  };

  useEffect(() => {
    applyPlayerTint(clone, color);
  }, [clone, color]);

  useEffect(() => {
    const idle = actions[CLIPS.idle];
    if (!idle) return;
    playLocomotionClip(idle, CLIPS.idle);
    currentClip.current = CLIPS.idle;
    return () => {
      idle.fadeOut(0.2);
      if (finishHandler.current) {
        mixer.removeEventListener("finished", finishHandler.current);
      }
    };
  }, [actions, mixer]);

  useFrame(() => {
    const state = animState.current;

    if (state.emoteSeq !== lastEmoteSeq.current && state.emoteId) {
      lastEmoteSeq.current = state.emoteSeq;
      playEmote(state.emoteId);
      return;
    }

    if (emoteMode.current !== "none") {
      const def = activeEmoteId.current
        ? EMOTES[activeEmoteId.current]
        : null;
      const shouldCancel =
        state.isMoving &&
        def &&
        (def.loop || def.holdLastFrame || emoteMode.current === "held");
      if (shouldCancel) {
        clearEmote();
      } else {
        return;
      }
    }

    const target = pickLocomotionClip(state);
    if (target === currentClip.current) return;

    const next = actions[target];
    const prev = currentClip.current ? actions[currentClip.current] : null;
    if (!next) return;

    playLocomotionClip(next, target);
    prev?.fadeOut(0.2);
    currentClip.current = target;
  });

  return (
    <group ref={group} scale={MODEL_SCALE}>
      <primitive object={clone} />
    </group>
  );
}

useGLTF.preload(CHARACTER_MODEL_URL);
