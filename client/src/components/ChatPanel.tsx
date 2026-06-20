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
  onClick,
}: {
  player: OnlinePlayer;
  active: boolean;
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
    </button>
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
  const messagesRef = useRef<HTMLDivElement>(null);

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
          onClick={() => setTab("world")}
        >
          World
        </button>
        <button
          type="button"
          className={`chat-tab ${tab === "private" ? "active" : ""}`}
          onClick={() => setTab("private")}
        >
          Private
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
                  onClick={() => setActiveDmId(player.id)}
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
