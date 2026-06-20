import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { Room } from "colyseus.js";
import { joinWorld, getStateCallbacks, pingServer } from "./network/colyseus";
import { World } from "./components/World";
import { MobileControls } from "./components/MobileControls";
import { RadialEmoteWheel } from "./components/RadialEmoteWheel";
import { ChatPanel } from "./components/ChatPanel";
import { CharacterPreview } from "./components/CharacterPreview";
import { useIsMobile } from "./hooks/useIsMobile";
import { useMobileInput, requestMobileEmote } from "./context/MobileInputContext";

// connecting -> verifying the server is reachable
// offline    -> server could not be reached (retrying)
// ready      -> server is up; show name entry / enter the world
type Phase = "connecting" | "offline" | "ready";

export default function App() {
  const isMobile = useIsMobile();
  const mobileInput = useMobileInput();
  const [phase, setPhase] = useState<Phase>("connecting");
  const [name, setName] = useState("");
  const [joinedName, setJoinedName] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState("");
  const [count, setCount] = useState(0);
  const [joinError, setJoinError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRoomRef = useRef<Room | null>(null);

  // Step 1: confirm the server is reachable before showing the name entry.
  useEffect(() => {
    if (phase !== "connecting") return;
    let active = true;
    pingServer().then((ok) => {
      if (active) setPhase(ok ? "ready" : "offline");
    });
    return () => {
      active = false;
    };
  }, [phase]);

  // While offline, automatically re-check the server every few seconds.
  useEffect(() => {
    if (phase !== "offline") return;
    const t = setTimeout(() => setPhase("connecting"), 4000);
    return () => clearTimeout(t);
  }, [phase]);

  // Step 3: once a name is entered, join the world room.
  useEffect(() => {
    if (!joinedName) return;

    let cancelled = false;

    setJoinError("");
    setStatus("Entering IskaWorld...");

    joinWorld(joinedName)
      .then((r) => {
        if (cancelled) {
          r.leave();
          return;
        }

        activeRoomRef.current = r;
        setRoom(r);
        setStatus("Connected");

        const players: any = r.state.players;
        const $ = getStateCallbacks(r);
        const updateCount = () => setCount(players.size);
        $(r.state).players.onAdd(() => updateCount());
        $(r.state).players.onRemove(() => updateCount());
        updateCount();

        r.onLeave(() => {
          if (activeRoomRef.current !== r) return;
          activeRoomRef.current = null;
          setStatus("Disconnected");
          setRoom(null);
          setJoinedName(null);
          setPhase("connecting");
        });
      })
      .catch((e) => {
        console.error(e);
        if (cancelled) return;
        setStatus("Failed to join the world.");
        setJoinError("Could not join the world. Please try again.");
        setJoinedName(null);
        setPhase("ready");
      });

    return () => {
      cancelled = true;
      if (activeRoomRef.current) {
        activeRoomRef.current.leave();
        activeRoomRef.current = null;
      }
    };
  }, [joinedName]);

  const enterWorld = () => {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      setJoinError("");
      setJoinedName(trimmed.slice(0, 16));
    }
  };

  // --- Phase 1: verifying the connection to the server. ---
  if (phase === "connecting") {
    return (
      <div className="login">
        <div className="login-card">
          <h1>IskaWorld</h1>
          <div className="spinner" />
          <p>Connecting to the server…</p>
        </div>
      </div>
    );
  }

  // --- Phase 1b: server could not be reached. ---
  if (phase === "offline") {
    return (
      <div className="login">
        <div className="login-card">
          <h1>IskaWorld</h1>
          <p className="error">Can't reach the server.</p>
          <p>It may be starting up — retrying automatically…</p>
          <button onClick={() => setPhase("connecting")}>Retry now</button>
        </div>
      </div>
    );
  }

  // --- Phase 2: connected to the server, ask for a name. ---
  if (!joinedName) {
    return (
      <div className="login">
        <div className="login-card login-card-wide">
          <h1>IskaWorld</h1>
          <CharacterPreview color="#38bdf8" />
          <p className="connected">● Connected to server</p>
          <p>Enter your name to join IskaWorld</p>
          {joinError && <p className="error">{joinError}</p>}
          <input
            ref={inputRef}
            autoFocus
            maxLength={16}
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enterWorld()}
          />
          <button onClick={enterWorld} disabled={name.trim().length === 0}>
            Enter World
          </button>
        </div>
      </div>
    );
  }

  // --- Phase 3: in the world — show the scene, characters, and online count. ---
  return (
    <>
      <div className="hud hud-minimal">
        <span className="hud-connected">● Connected</span>
        <span>
          Online: <b>{count}</b>
        </span>
      </div>

      {room && isMobile && <MobileControls />}

      {room && !isMobile && mobileInput && (
        <RadialEmoteWheel
          className="radial-emote-desktop"
          onSelect={(id) => requestMobileEmote(mobileInput, id)}
        />
      )}

      {room && <ChatPanel room={room} />}

      {!room && (
        <div className="joining">
          <div className="spinner" />
          <p>Entering the world…</p>
        </div>
      )}

      <Canvas shadows camera={{ position: [0, 6, 9], fov: 60 }}>
        <Sky sunPosition={[100, 20, 100]} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        {room && <World room={room} />}
      </Canvas>
    </>
  );
}
