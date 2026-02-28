import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { api } from "./routes/api";

const frontendDist = path.join(process.cwd(), "frontend", "dist");
const hasBuiltFrontend = () => fs.existsSync(path.join(frontendDist, "index.html"));

const trustProxy = process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true";
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : true;

export function createApp() {
  const app = express();
  if (trustProxy) app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api", api);
  if (hasBuiltFrontend()) {
    app.use(express.static(frontendDist));
    app.use((_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
  } else {
    app.use((_req, res) => {
      res.type("html").send(`
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Clawkpit</title></head><body>
<p>In development, the app is served by Vite.</p>
<p>Use <a href="http://localhost:5173">http://localhost:5173</a> for the UI. The API is available on this port at <code>/api</code>.</p>
</body></html>`);
    });
  }
  return app;
}
