import { Room, Client } from "@colyseus/core";
import { IskaState, Player } from "./schema/IskaState";

interface MovePayload {
  x: number;
  y: number;
  z: number;
  rotation: number;
  moving?: boolean;
}

interface EmotePayload {
  id: string;
}

interface ShovePayload {
  target: string; // sessionId of the player being pushed
  dx: number; // push direction (unit vector)
  dz: number;
}

interface ChatPayload {
  text: string;
}

interface WhisperPayload {
  target: string;
  text: string;
}

const MAX_CHAT_LENGTH = 200;

function sanitizeChat(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, MAX_CHAT_LENGTH);
}

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

const VALID_EMOTES = new Set([
  "clapping",
  "death",
  "punch",
  "roll",
  "sitting",
  "standing",
  "swordSlash",
]);

export class IskaRoom extends Room<IskaState> {
  maxClients = 50;

  onCreate(options: any) {
    this.state = new IskaState();

    // Client tells us where it moved; we update its player in the shared state.
    this.onMessage("move", (client, data: MovePayload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.x = data.x;
      player.y = data.y;
      player.z = data.z;
      player.rotation = data.rotation;
      player.moving = !!data.moving;
    });

    // Player-vs-player push: relay the impulse to the target's own client,
    // which is authoritative over that avatar's position (knockback).
    this.onMessage("shove", (client, data: ShovePayload) => {
      const target = this.clients.find((c) => c.sessionId === data.target);
      if (target) {
        target.send("shoved", { dx: data.dx, dz: data.dz });
      }
    });

    this.onMessage("chat", (client, data: ChatPayload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const text = sanitizeChat(data.text);
      if (!text) return;

      this.broadcast("chat", {
        fromId: client.sessionId,
        fromName: player.name,
        fromColor: player.color,
        text,
        timestamp: Date.now(),
      });
    });

    this.onMessage("whisper", (client, data: WhisperPayload) => {
      const player = this.state.players.get(client.sessionId);
      const target = this.clients.find((c) => c.sessionId === data.target);
      const targetPlayer = this.state.players.get(data.target);
      if (!player || !target || !targetPlayer || target.sessionId === client.sessionId) return;

      const text = sanitizeChat(data.text);
      if (!text) return;

      const payload = {
        fromId: client.sessionId,
        fromName: player.name,
        fromColor: player.color,
        toId: target.sessionId,
        toName: targetPlayer.name,
        text,
        timestamp: Date.now(),
      };

      client.send("whisper", payload);
      target.send("whisper", payload);
    });

    this.onMessage("emote", (client, data: EmotePayload) => {
      if (!VALID_EMOTES.has(data.id)) return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.emote = data.id;
      player.emoteSeq += 1;
    });

    console.log("IskaRoom created:", this.roomId);
  }

  onJoin(client: Client, options: { name?: string }) {
    const player = new Player();
    player.id = client.sessionId;
    player.name = options?.name || `Student-${client.sessionId.substring(0, 4)}`;
    player.color = COLORS[Math.floor(Math.random() * COLORS.length)];

    // Spawn at a small random offset so players don't overlap.
    player.x = (Math.random() - 0.5) * 6;
    player.y = 0;
    player.z = (Math.random() - 0.5) * 6;

    this.state.players.set(client.sessionId, player);

    this.broadcast("presence", {
      event: "joined",
      id: client.sessionId,
      name: player.name,
      color: player.color,
    });
    console.log(`${player.name} joined (${client.sessionId})`);
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      this.broadcast("presence", {
        event: "left",
        id: client.sessionId,
        name: player.name,
      });
    }
    this.state.players.delete(client.sessionId);
    console.log(`${player?.name ?? client.sessionId} left`);
  }

  onDispose() {
    console.log("IskaRoom disposed:", this.roomId);
  }
}
