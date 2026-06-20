import { createContext, useContext, useRef, type ReactNode } from "react";
import type { EmoteId } from "../character/emotes";

export interface MobileInput {
  moveX: number;
  moveY: number;
  jump: boolean;
  lookDeltaX: number;
  lookActive: boolean;
  emoteSeq: number;
  emoteId: EmoteId | null;
  punchSeq: number;
}

const MobileInputContext = createContext<MobileInput | null>(null);

export function MobileInputProvider({ children }: { children: ReactNode }) {
  const input = useRef<MobileInput>({
    moveX: 0,
    moveY: 0,
    jump: false,
    lookDeltaX: 0,
    lookActive: false,
    emoteSeq: 0,
    emoteId: null,
    punchSeq: 0,
  }).current;
  return (
    <MobileInputContext.Provider value={input}>
      {children}
    </MobileInputContext.Provider>
  );
}

export function useMobileInput() {
  return useContext(MobileInputContext);
}

export function requestMobileEmote(input: MobileInput, id: EmoteId) {
  input.emoteId = id;
  input.emoteSeq += 1;
}

export function requestMobilePunch(input: MobileInput) {
  input.punchSeq += 1;
}
