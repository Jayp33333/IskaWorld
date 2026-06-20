import http from "http";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import { IskaRoom } from "./rooms/IskaRoom";

const port = Number(process.env.PORT) || 2567;
const isProd = process.env.NODE_ENV === "production";

const app = express();

// CORS: allow all in dev; in prod restrict to a comma-separated allowlist
// from CLIENT_ORIGIN (e.g. "https://iskaworld.vercel.app").
const allowed = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowed.length > 0 ? allowed : true,
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("IskaWorld server is running.");
});

// HTTP Basic Auth gate for the monitor dashboard.
function basicAuth(req: Request, res: Response, next: NextFunction) {
  const user = process.env.MONITOR_USER;
  const pass = process.env.MONITOR_PASS;
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [u, p] = Buffer.from(encoded, "base64").toString().split(":");
    if (u === user && p === pass) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="IskaWorld Monitor"');
  res.status(401).send("Authentication required.");
}

// Monitor (room/player inspector). In production it's only exposed when
// credentials are set, and is always password-protected.
if (process.env.MONITOR_USER && process.env.MONITOR_PASS) {
  app.use("/monitor", basicAuth, monitor());
} else if (!isProd) {
  app.use("/monitor", monitor());
}

const server = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
    pingInterval: 2000,
    pingMaxRetries: 2,
  }),
});

gameServer.define("iska", IskaRoom);

gameServer.listen(port);
console.log(`IskaWorld listening on ws://localhost:${port}`);
