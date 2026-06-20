import { useEffect, useState } from "react";
import { Room } from "colyseus.js";
import { getStateCallbacks } from "../network/colyseus";
import type { PresenceNotice } from "../hooks/usePlayerPresence";
import { Ground } from "./Ground";
import { LocalPlayer } from "./LocalPlayer";
import { RemotePlayer } from "./RemotePlayer";

interface Props {
  room: Room;
}

// Reacts to players joining/leaving and renders local + remote avatars.
export function World({ room }: Props) {
  const [remoteIds, setRemoteIds] = useState<string[]>([]);
  const [me, setMe] = useState<{ name: string; color: string } | null>(null);

  useEffect(() => {
    const players: any = room.state.players;
    const $ = getStateCallbacks(room);

    const refresh = () => {
      const ids: string[] = [];
      players.forEach((_: any, key: string) => {
        if (key !== room.sessionId) ids.push(key);
      });
      setRemoteIds(ids);

      const self = players.get(room.sessionId);
      if (self) setMe({ name: self.name, color: self.color });
    };

    const removeRemote = (sessionId: string) => {
      setRemoteIds((prev) => prev.filter((id) => id !== sessionId));
    };

    const offAdd = $(room.state).players.onAdd(() => refresh());
    const offRemove = $(room.state).players.onRemove((_player: any, sessionId: string) => {
      removeRemote(sessionId);
    });
    const offPresence = room.onMessage("presence", (data: PresenceNotice) => {
      if (data.event === "left") removeRemote(data.id);
      else if (data.event === "joined") refresh();
    });
    refresh();

    return () => {
      offAdd?.();
      offRemove?.();
      offPresence?.();
    };
  }, [room]);

  return (
    <>
      <Ground />

      {me && <LocalPlayer room={room} name={me.name} color={me.color} />}

      {remoteIds.map((id) => {
        const state = (room.state.players as any).get(id);
        if (!state) return null;
        return <RemotePlayer key={id} state={state} />;
      })}
    </>
  );
}
