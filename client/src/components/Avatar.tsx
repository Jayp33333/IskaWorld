import { useRef, type MutableRefObject } from "react";
import { Billboard, Text } from "@react-three/drei";
import { CharacterAnimState, CharacterModel } from "./CharacterModel";
import type { EmoteId } from "../character/emotes";

interface Props {
  color: string;
  name: string;
  animState: MutableRefObject<CharacterAnimState>;
}

export function Avatar({ color, name, animState }: Props) {
  return (
    <group>
      <CharacterModel color={color} animState={animState} />

      <Billboard position={[0, 1.85, 0]}>
        <Text
          fontSize={0.28}
          color="#e2e8f0"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#0f172a"
        >
          {name}
        </Text>
      </Billboard>
    </group>
  );
}

export function createCharacterAnimState(): CharacterAnimState {
  return {
    isMoving: false,
    isGrounded: true,
    emoteSeq: 0,
    emoteId: null,
  };
}

export function useCharacterAnimState(): MutableRefObject<CharacterAnimState> {
  return useRef<CharacterAnimState>(createCharacterAnimState());
}

export function triggerEmote(
  animState: MutableRefObject<CharacterAnimState>,
  id: EmoteId
) {
  animState.current.emoteId = id;
  animState.current.emoteSeq += 1;
}
