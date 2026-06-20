import { useMemo, useState, type CSSProperties } from "react";
import { MdEmojiEmotions } from "react-icons/md";
import { EMOTE_WHEEL_LIST } from "../character/emotes";
import type { EmoteId } from "../character/emotes";

const WHEEL_RADIUS = 92;
// Arc opens to the left from the right-center anchor.
const ARC_START = Math.PI - Math.PI * 0.48;
const ARC_END = Math.PI + Math.PI * 0.48;

interface Props {
  onSelect: (id: EmoteId) => void;
  className?: string;
}

export function RadialEmoteWheel({ onSelect, className = "" }: Props) {
  const [open, setOpen] = useState(false);

  const slots = useMemo(() => {
    const count = EMOTE_WHEEL_LIST.length;
    return EMOTE_WHEEL_LIST.map((emote, index) => {
      const t = count === 1 ? 0.5 : index / (count - 1);
      const angle = ARC_START + (ARC_END - ARC_START) * t;
      return {
        ...emote,
        x: Math.cos(angle) * WHEEL_RADIUS,
        y: Math.sin(angle) * WHEEL_RADIUS,
        delay: index * 0.03,
      };
    });
  }, []);

  const pickEmote = (id: EmoteId) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div className={`radial-emote ${className}`.trim()}>
      {open && (
        <button
          type="button"
          className="radial-emote-backdrop"
          aria-label="Close emote menu"
          onPointerDown={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        />
      )}

      <div className={`radial-emote-wheel ${open ? "open" : ""}`}>
        {slots.map((emote) => {
          const Icon = emote.Icon;
          return (
            <button
              key={emote.id}
              type="button"
              className="radial-emote-item"
              style={
                {
                  "--emote-x": `${emote.x}px`,
                  "--emote-y": `${emote.y}px`,
                  "--emote-delay": `${emote.delay}s`,
                } as CSSProperties
              }
              title={emote.label}
              aria-label={emote.label}
              onPointerDown={(e) => {
                e.stopPropagation();
                pickEmote(emote.id);
              }}
            >
              <Icon className="radial-emote-icon" aria-hidden="true" />
            </button>
          );
        })}

        <button
          type="button"
          className={`radial-emote-toggle ${open ? "active" : ""}`}
          aria-label={open ? "Close emotes" : "Open emotes"}
          aria-expanded={open}
          onPointerDown={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          <MdEmojiEmotions className="radial-emote-toggle-icon" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
