import { useEffect, useRef, useState } from "react";
import { Room } from "colyseus.js";
import { getStateCallbacks } from "../network/colyseus";

export interface ChatMessage {
  id: string;
  fromId: string;
  fromName: string;
  fromColor: string;
  text: string;
  timestamp: number;
}

export interface WhisperMessage extends ChatMessage {
  toId: string;
  toName: string;
}

export interface OnlinePlayer {
  id: string;
  name: string;
  color: string;
}

let messageCounter = 0;

function nextId() {
  messageCounter += 1;
  return `msg-${messageCounter}`;
}

function worldKey(msg: Pick<ChatMessage, "fromId" | "timestamp" | "text">) {
  return `world:${msg.fromId}:${msg.timestamp}:${msg.text}`;
}

function whisperKey(
  msg: Pick<WhisperMessage, "fromId" | "toId" | "timestamp" | "text">
) {
  return `whisper:${msg.fromId}:${msg.toId}:${msg.timestamp}:${msg.text}`;
}

export function useChat(room: Room) {
  const [worldMessages, setWorldMessages] = useState<ChatMessage[]>([]);
  const [dmThreads, setDmThreads] = useState<Record<string, WhisperMessage[]>>({});
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const roomRef = useRef(room);
  const seenWorld = useRef(new Set<string>());
  const seenWhisper = useRef(new Set<string>());
  roomRef.current = room;

  useEffect(() => {
    const players: any = room.state.players;
    const $ = getStateCallbacks(room);

    const refreshPlayers = () => {
      const list: OnlinePlayer[] = [];
      players.forEach((player: any, id: string) => {
        if (id === room.sessionId) return;
        list.push({
          id,
          name: player.name,
          color: player.color,
        });
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setOnlinePlayers(list);
    };

    refreshPlayers();
    const offAdd = $(room.state).players.onAdd(() => refreshPlayers());
    const offRemove = $(room.state).players.onRemove((_player: any, sessionId: string) => {
      setOnlinePlayers((prev) => prev.filter((p) => p.id !== sessionId));
    });

    const onPresence = (data: { event: string; id: string }) => {
      if (data.event === "left") {
        setOnlinePlayers((prev) => prev.filter((p) => p.id !== data.id));
      } else if (data.event === "joined") {
        refreshPlayers();
      }
    };

    const onChat = (msg: Omit<ChatMessage, "id">) => {
      const key = worldKey(msg);
      if (seenWorld.current.has(key)) return;
      seenWorld.current.add(key);
      setWorldMessages((prev) => [...prev, { ...msg, id: nextId() }]);
    };

    const onWhisper = (msg: Omit<WhisperMessage, "id">) => {
      const key = whisperKey(msg);
      if (seenWhisper.current.has(key)) return;
      seenWhisper.current.add(key);

      const threadId =
        msg.fromId === room.sessionId ? msg.toId : msg.fromId;
      setDmThreads((prev) => ({
        ...prev,
        [threadId]: [...(prev[threadId] ?? []), { ...msg, id: nextId() }],
      }));
    };

    const offChat = room.onMessage("chat", onChat);
    const offWhisper = room.onMessage("whisper", onWhisper);
    const offPresence = room.onMessage("presence", onPresence);

    return () => {
      offAdd?.();
      offRemove?.();
      offChat?.();
      offWhisper?.();
      offPresence?.();
    };
  }, [room]);

  const sendWorld = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    roomRef.current.send("chat", { text: trimmed });
  };

  const sendWhisper = (targetId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    roomRef.current.send("whisper", { target: targetId, text: trimmed });
  };

  return {
    worldMessages,
    dmThreads,
    onlinePlayers,
    sendWorld,
    sendWhisper,
    selfId: room.sessionId,
  };
}
