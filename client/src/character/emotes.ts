import type { IconType } from "react-icons";
import {
  FaArrowsRotate,
  FaChair,
  FaHandFist,
  FaHandsClapping,
  FaPerson,
  FaSkull,
} from "react-icons/fa6";
import { GiCrossedSwords } from "react-icons/gi";

export interface EmoteDef {
  clip: string;
  key: string;
  label: string;
  Icon: IconType;
  loop: boolean;
  holdLastFrame: boolean;
}

export const EMOTES = {
  clapping: {
    clip: "Man_Clapping",
    key: "Digit1",
    label: "Clap",
    Icon: FaHandsClapping,
    loop: false,
    holdLastFrame: false,
  },
  death: {
    clip: "Man_Death",
    key: "Digit2",
    label: "Death",
    Icon: FaSkull,
    loop: false,
    holdLastFrame: true,
  },
  punch: {
    clip: "Man_Punch",
    key: "Digit3",
    label: "Punch",
    Icon: FaHandFist,
    loop: false,
    holdLastFrame: false,
  },
  roll: {
    clip: "Man_Roll",
    key: "Digit4",
    label: "Roll",
    Icon: FaArrowsRotate,
    loop: false,
    holdLastFrame: false,
  },
  sitting: {
    clip: "Man_Sitting",
    key: "Digit5",
    label: "Sit",
    Icon: FaChair,
    loop: true,
    holdLastFrame: false,
  },
  standing: {
    clip: "Man_Standing",
    key: "Digit6",
    label: "Stand",
    Icon: FaPerson,
    loop: true,
    holdLastFrame: false,
  },
  swordSlash: {
    clip: "Man_SwordSlash",
    key: "Digit7",
    label: "Slash",
    Icon: GiCrossedSwords,
    loop: false,
    holdLastFrame: false,
  },
} as const satisfies Record<string, EmoteDef>;

export type EmoteId = keyof typeof EMOTES;

export const EMOTE_LIST = Object.entries(EMOTES).map(([id, def]) => ({
  id: id as EmoteId,
  ...def,
}));

// Punch is a combat action, not shown on the emote wheel.
export const EMOTE_WHEEL_LIST = EMOTE_LIST.filter((emote) => emote.id !== "punch");

export const PUNCH_EMOTE_ID = "punch" as const;

export const EMOTE_BY_KEY: Partial<Record<string, EmoteId>> = Object.fromEntries(
  EMOTE_WHEEL_LIST.map((e) => [e.key, e.id])
);

export function isEmoteId(value: string): value is EmoteId {
  return value in EMOTES;
}
