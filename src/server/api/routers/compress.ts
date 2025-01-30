import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

const tinypngApiKey = process.env.TINY_PNG_API_KEY;

if (!tinypngApiKey) {
  throw new Error("TINY_PNG_API_KEY is not set in environment variables");
}

// 支持的图片类型
const SUPPORTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/avif'
] as const;

// 压缩选项类型
const compressionSchema = z.object({
  imageBase64: z.string(),
  filename: z.string(),
  mimeType: z.enum(SUPPORTED_MIME_TYPES),
  outputFormat: z.enum(SUPPORTED_MIME_TYPES),
  options: z.object({
    quality: z.number().min(1).max(100).optional(),
    preserveMetadata: z.boolean().optional(),
    resize: z.object({
      width: z.number().optional(),
      height: z.number().optional(),
      method: z.enum(['fit', 'cover', 'contain']).optional(),
    }).optional(),
    convertAutomatically: z.boolean().optional(),
  }).optional(),
});

// Add these interfaces at the top of the file
interface TinyPNGOptions {
  resize?: {
    width?: number;
    height?: number;
    method?: 'fit' | 'cover' | 'contain';
  };
  preserve?: string[];
  convert?: {
    type: typeof SUPPORTED_MIME_TYPES[number];
  };
}

interface TinyPNGResponse {
  output: {
    url: string;
    size: number;
    type: string;
  };
}

export const compressRouter = createTRPCRouter({
  compress: publicProcedure
    .input(compressionSchema)
    .mutation(async ({ input }) => {
      try {
        const base64Data = input.imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        const apiOptions: TinyPNGOptions = {
          resize: input.options?.resize,
          preserve: input.options?.preserveMetadata ? ["copyright", "creation", "location"] : [],
        };

        if (input.outputFormat !== input.mimeType) {
          apiOptions.convert = { type: input.outputFormat };
        }

        const response = await fetch("https://api.tinify.com/shrink", {
          method: "POST",
          body: imageBuffer,
          headers: {
            Authorization: `Basic ${Buffer.from(`api:${tinypngApiKey}`).toString("base64")}`,
            "Content-Type": input.mimeType,
          },
        });

        if (!response.ok) {
          const errorData = await response.json() as { message: string };
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: errorData.message || "Failed to compress image",
          });
        }

        const data = await response.json() as TinyPNGResponse;
        let finalUrl = data.output.url;

        if (apiOptions.convert) {
          const convertResponse = await fetch(data.output.url, {
            method: "POST",
            body: JSON.stringify(apiOptions),
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${Buffer.from(`api:${tinypngApiKey}`).toString("base64")}`,
            },
          });

          if (!convertResponse.ok) {
            const errorText = await convertResponse.text();
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Failed to convert image format",
            });
          }

          const contentType = convertResponse.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            const convertData = await convertResponse.json() as TinyPNGResponse;
            finalUrl = convertData.output.url;
          } else {
            const imageBuffer = await convertResponse.arrayBuffer();
            const base64 = Buffer.from(imageBuffer).toString("base64");
            
            return {
              success: true,
              originalSize: imageBuffer.byteLength,
              compressedSize: imageBuffer.byteLength,
              savedBytes: 0,
              compressionRatio: 0,
              compressedImage: `data:${input.outputFormat};base64,${base64}`,
              originalType: input.mimeType,
              outputType: input.outputFormat,
            };
          }
        }

        const compressedImageResponse = await fetch(finalUrl);
        if (!compressedImageResponse.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch compressed image",
          });
        }

        const compressedImageBuffer = await compressedImageResponse.arrayBuffer();
        const compressedBase64 = Buffer.from(compressedImageBuffer).toString("base64");

        const originalSize = imageBuffer.length;
        const compressedSize = data.output.size;
        const savedBytes = originalSize - compressedSize;
        const compressionRatio = Math.round((savedBytes / originalSize) * 100);

        return {
          success: true,
          originalSize,
          compressedSize,
          savedBytes,
          compressionRatio,
          compressedImage: `data:${input.mimeType};base64,${compressedBase64}`,
          originalType: input.mimeType,
          outputType: data.output.type || input.mimeType,
        };

      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to compress image",
          cause: error,
        });
      }
    }),
});
