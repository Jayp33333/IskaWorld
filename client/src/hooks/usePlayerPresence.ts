import { useCallback, useEffect, useRef, useState } from "react";
import { Room } from "colyseus.js";
import { getStateCallbacks } from "../network/colyseus";

export interface PresenceNotice {
  event: "joined" | "left";
  id: string;
  name: string;
  color?: string;
}

export function usePlayerPresence(room: Room | null) {
  const [count, setCount] = useState(0);
  const [notice, setNotice] = useState<PresenceNotice | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>();

  const showNotice = useCallback((payload: PresenceNotice) => {
    setNotice(payload);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  }, []);

  useEffect(() => {
    if (!room) {
      setCount(0);
      setNotice(null);
      return;
    }

    const players: any = room.state.players;
    const $ = getStateCallbacks(room);

    const updateCount = () => setCount(players.size);

    const offAdd = $(room.state).players.onAdd(() => updateCount());
    const offRemove = $(room.state).players.onRemove(() => updateCount());

    const offPresence = room.onMessage("presence", (data: PresenceNotice) => {
      if (data.event === "left") {
        showNotice(data);
      } else if (data.event === "joined" && data.id !== room.sessionId) {
        showNotice(data);
      }
    });

    updateCount();

    return () => {
      offAdd?.();
      offRemove?.();
      offPresence?.();
      clearTimeout(noticeTimer.current);
    };
  }, [room, showNotice]);

  return { count, notice };
}
