import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

export async function createSocketServer(
  corsOrigin: string = "*",
): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: corsOrigin });
  return app;
}
