import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

const PORT = Number(process.env.PORT) || 3000;

const app = new Elysia()
  .use(
    cors({
      origin: true,
    })
  )
  .get("/", () => ({
    success: true,
    message: "CarStock API is running",
  }))
  .get("/api/v1/health", () => ({
    success: true,
    message: "CarStock Backend is healthy",
    timestamp: new Date().toISOString(),
  }))
  .listen(PORT);

console.log(`
🚀 CarStock Backend started!
🌐 Local: http://localhost:${PORT}
❤️ Health: http://localhost:${PORT}/api/v1/health
`);