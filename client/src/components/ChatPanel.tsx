import { useEffect, useMemo, useRef, useState } from "react";
import { Room } from "colyseus.js";
import {
  HiChatBubbleLeftRight,
  HiChevronDown,
  HiPaperAirplane,
  HiUsers,
  HiXMark,
} from "react-icons/hi2";
import { useChat, type OnlinePlayer } from "../hooks/useChat";

type ChatTab = "world" | "private";

interface Props {
  room: Room;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageBubble({
  name,
  color,
  text,
  time,
  isSelf,
}: {
  name: string;
  color: string;
  text: string;
  time: string;
  isSelf?: boolean;
}) {
  return (
    <div className={`chat-message ${isSelf ? "self" : ""}`}>
      <div className="chat-message-meta">
        <span className="chat-message-name" style={{ color }}>
          {name}
        </span>
        <span className="chat-message-time">{time}</span>
      </div>
      <p className="chat-message-text">{text}</p>
    </div>
  );
}

function PlayerChip({
  player,
  active,
  unread,
  onClick,
}: {
  player: OnlinePlayer;
  active: boolean;
  unread?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`chat-player-chip ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span className="chat-player-dot" style={{ background: player.color }} />
      <span>{player.name}</span>
      <ChatBadge count={unread ?? 0} />
    </button>
  );
}

function ChatBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="chat-badge" aria-label={`${count} unread messages`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function ChatPanel({ room }: Props) {
  const {
    worldMessages,
    dmThreads,
    onlinePlayers,
    sendWorld,
    sendWhisper,
    selfId,
  } = useChat(room);

  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<ChatTab>("world");
  const [draft, setDraft] = useState("");
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [worldUnread, setWorldUnread] = useState(0);
  const [privateUnread, setPrivateUnread] = useState<Record<string, number>>({});
  const messagesRef = useRef<HTMLDivElement>(null);
  const worldLenRef = useRef(0);
  const dmLenRef = useRef<Record<string, number>>({});
  const worldInitRef = useRef(false);
  const dmInitRef = useRef(false);

  const totalPrivateUnread = useMemo(
    () => Object.values(privateUnread).reduce((sum, n) => sum + n, 0),
    [privateUnread]
  );
  const totalUnread = worldUnread + totalPrivateUnread;

  const activeDmPlayer = useMemo(
    () => onlinePlayers.find((p) => p.id === activeDmId) ?? null,
    [activeDmId, onlinePlayers]
  );

  const activeMessages = useMemo(() => {
    if (tab === "world") return worldMessages;
    if (!activeDmId) return [];
    return dmThreads[activeDmId] ?? [];
  }, [tab, worldMessages, activeDmId, dmThreads]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeMessages, open, tab, activeDmId]);

  useEffect(() => {
    if (tab === "private" && !activeDmId && onlinePlayers.length > 0) {
      setActiveDmId(onlinePlayers[0].id);
    }
  }, [tab, activeDmId, onlinePlayers]);

  useEffect(() => {
    if (!worldInitRef.current) {
      worldInitRef.current = true;
      worldLenRef.current = worldMessages.length;
      return;
    }

    if (worldMessages.length <= worldLenRef.current) {
      worldLenRef.current = worldMessages.length;
      return;
    }

    const newMessages = worldMessages.slice(worldLenRef.current);
    worldLenRef.current = worldMessages.length;

    const shouldNotify = !open || tab !== "world";
    if (!shouldNotify) return;

    const incoming = newMessages.filter((msg) => msg.fromId !== selfId).length;
    if (incoming > 0) {
      setWorldUnread((count) => count + incoming);
    }
  }, [worldMessages, open, tab, selfId]);

  useEffect(() => {
    if (!dmInitRef.current) {
      dmInitRef.current = true;
      for (const [playerId, messages] of Object.entries(dmThreads)) {
        dmLenRef.current[playerId] = messages.length;
      }
      return;
    }

    for (const [playerId, messages] of Object.entries(dmThreads)) {
      const prevCount = dmLenRef.current[playerId] ?? 0;
      if (messages.length <= prevCount) continue;

      const newMessages = messages.slice(prevCount);
      dmLenRef.current[playerId] = messages.length;

      const shouldNotify = !open || tab !== "private" || activeDmId !== playerId;
      if (!shouldNotify) continue;

      const incoming = newMessages.filter((msg) => msg.fromId !== selfId).length;
      if (incoming > 0) {
        setPrivateUnread((prev) => ({
          ...prev,
          [playerId]: (prev[playerId] ?? 0) + incoming,
        }));
      }
    }
  }, [dmThreads, open, tab, activeDmId, selfId]);

  useEffect(() => {
    if (open && tab === "world") {
      setWorldUnread(0);
    }
  }, [open, tab, worldMessages.length]);

  useEffect(() => {
    if (open && tab === "private" && activeDmId) {
      setPrivateUnread((prev) => ({ ...prev, [activeDmId]: 0 }));
    }
  }, [open, tab, activeDmId, dmThreads[activeDmId ?? ""]?.length]);

  const selectPrivateTab = () => setTab("private");

  const selectWorldTab = () => setTab("world");

  const selectDmPlayer = (playerId: string) => {
    setActiveDmId(playerId);
    setPrivateUnread((prev) => ({ ...prev, [playerId]: 0 }));
  };

  const submit = () => {
    const text = draft.trim();
    if (!text) return;

    if (tab === "world") {
      sendWorld(text);
    } else if (activeDmId) {
      sendWhisper(activeDmId, text);
    } else {
      return;
    }

    setDraft("");
  };

  if (!open) {
    return (
      <button
        type="button"
        className="chat-fab"
        onClick={() => setOpen(true)}
        aria-label="Open chat"
      >
        <HiChatBubbleLeftRight />
        <span>Chat</span>
        <ChatBadge count={totalUnread} />
      </button>
    );
  }

  return (
    <section className="chat-panel" aria-label="Chat">
      <header className="chat-header">
        <div className="chat-header-title">
          <HiChatBubbleLeftRight />
          <span>Chat</span>
        </div>
        <div className="chat-header-actions">
          <button
            type="button"
            className="chat-icon-btn"
            onClick={() => setOpen(false)}
            aria-label="Minimize chat"
          >
            <HiChevronDown />
          </button>
        </div>
      </header>

      <div className="chat-tabs">
        <button
          type="button"
          className={`chat-tab ${tab === "world" ? "active" : ""}`}
          onClick={selectWorldTab}
        >
          <span>World</span>
          <ChatBadge count={worldUnread} />
        </button>
        <button
          type="button"
          className={`chat-tab ${tab === "private" ? "active" : ""}`}
          onClick={selectPrivateTab}
        >
          <span>Private</span>
          <ChatBadge count={totalPrivateUnread} />
        </button>
      </div>

      {tab === "private" && (
        <div className="chat-private-bar">
          <HiUsers className="chat-private-icon" />
          {onlinePlayers.length === 0 ? (
            <span className="chat-private-empty">No other players online</span>
          ) : (
            <div className="chat-player-list">
              {onlinePlayers.map((player) => (
                <PlayerChip
                  key={player.id}
                  player={player}
                  active={player.id === activeDmId}
                  unread={privateUnread[player.id] ?? 0}
                  onClick={() => selectDmPlayer(player.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "private" && activeDmPlayer && (
        <div className="chat-dm-header">
          <span className="chat-dm-label">Messaging</span>
          <span className="chat-dm-name" style={{ color: activeDmPlayer.color }}>
            {activeDmPlayer.name}
          </span>
          <button
            type="button"
            className="chat-icon-btn small"
            onClick={() => setActiveDmId(null)}
            aria-label="Clear selected player"
          >
            <HiXMark />
          </button>
        </div>
      )}

      <div className="chat-messages" ref={messagesRef}>
        {tab === "private" && !activeDmId && onlinePlayers.length > 0 && (
          <p className="chat-placeholder">Select a player to start a private chat.</p>
        )}
        {tab === "private" && onlinePlayers.length === 0 && (
          <p className="chat-placeholder">Private chat is available when someone else joins.</p>
        )}
        {tab === "world" && worldMessages.length === 0 && (
          <p className="chat-placeholder">Say hello to the world…</p>
        )}
        {activeMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            name={msg.fromName}
            color={msg.fromColor}
            text={msg.text}
            time={formatTime(msg.timestamp)}
            isSelf={msg.fromId === selfId}
          />
        ))}
      </div>

      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          type="text"
          className="chat-input"
          maxLength={200}
          placeholder={
            tab === "world"
              ? "Message everyone…"
              : activeDmPlayer
                ? `Message ${activeDmPlayer.name}…`
                : "Select a player first…"
          }
          value={draft}
          disabled={tab === "private" && !activeDmId}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!draft.trim() || (tab === "private" && !activeDmId)}
          aria-label="Send message"
        >
          <HiPaperAirplane />
        </button>
      </form>
    </section>
  );
}
