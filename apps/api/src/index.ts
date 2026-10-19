import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env, isProd } from "./config/env";
import { errorHandler, notFoundHandler } from "./utils/errors";
import authRoutes from "./routes/auth.routes";
import profileRoutes from "./routes/profile.routes";
import foodsRoutes from "./routes/foods.routes";
import mealsRoutes from "./routes/meals.routes";
import coachRoutes from "./routes/coach.routes";
import dietitianRoutes from "./routes/dietitian.routes";
import sessionsRoutes from "./routes/sessions.routes";
import paymentsRoutes from "./routes/payments.routes";
import adminRoutes from "./routes/admin.routes";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: isProd ? [env.APP_URL] : true,
    credentials: true,
  }),
);
app.use(pinoHttp({ level: isProd ? "info" : "debug" }));

// Webhooks must be mounted before the JSON body parser (raw signature check).
app.use("/api/payments", paymentsRoutes);

app.use(express.json({ limit: "1mb" }));

app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 240,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "nutribyte-api", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/foods", foodsRoutes);
app.use("/api/meals", mealsRoutes);
app.use("/api/coach", coachRoutes);
app.use("/api/dietitian", dietitianRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`NutriByte API listening on ${env.API_URL} (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
