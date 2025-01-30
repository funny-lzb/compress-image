import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // 使用 optional() 使 TINY_PNG_API_KEY 在生产环境中可选
    TINY_PNG_API_KEY: z
      .string()
      .min(1)
      .optional()
      .default("8XKH50kd2s3dGtGpPLyf560DyBTVwhS0"),
  },

  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    TINY_PNG_API_KEY: process.env.TINY_PNG_API_KEY,
  },

  skipValidation: process.env.NODE_ENV === "production", // 在生产环境中跳过验证
  emptyStringAsUndefined: true,
});
