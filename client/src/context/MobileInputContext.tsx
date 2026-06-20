import { createContext, useContext, useRef, type ReactNode } from "react";

export interface MobileInput {
  moveX: number;
  moveY: number;
  jump: boolean;
  lookDeltaX: number;
  lookActive: boolean;
}

const MobileInputContext = createContext<MobileInput | null>(null);

export function MobileInputProvider({ children }: { children: ReactNode }) {
  const input = useRef<MobileInput>({
    moveX: 0,
    moveY: 0,
    jump: false,
    lookDeltaX: 0,
    lookActive: false,
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
