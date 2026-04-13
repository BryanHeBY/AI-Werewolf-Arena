import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

/**
 * 轻量 Fastify 工厂：主要供测试或独立 transport 组装场景使用。
 */
export async function createSocketServer(
  corsOrigin: string = "*",
): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: corsOrigin });
  return app;
}
