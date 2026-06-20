import { Client, Room, getStateCallbacks } from "colyseus.js";

export { getStateCallbacks };

// Point this at your server. In production use wss:// behind TLS.
const ENDPOINT =
  import.meta.env.VITE_SERVER_URL || "ws://localhost:2567";

export const client = new Client(ENDPOINT);

// HTTP(S) version of the endpoint, used for a lightweight health check
// before we let the user enter the world. ws -> http, wss -> https.
const HTTP_ENDPOINT = ENDPOINT.replace(/^ws/, "http");

// Returns true if the server's health endpoint responds, false otherwise.
// Used to show a "Connecting…" / "Can't reach server" state up front.
export async function pingServer(timeoutMs = 8000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(HTTP_ENDPOINT + "/", {
      method: "GET",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
}

export async function joinWorld(name: string): Promise<Room> {
  return client.joinOrCreate("iska", { name });
}
