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

export const compressRouter = createTRPCRouter({
  compress: publicProcedure
    .input(compressionSchema)
    .mutation(async ({ input }) => {
      try {
        console.log("Compression request received:", {
          inputMimeType: input.mimeType,
          requestedOutputFormat: input.outputFormat,
          filename: input.filename,
          autoConvert: input.options?.convertAutomatically
        });

        const base64Data = input.imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        // 构建 TinyPNG API 选项
        const apiOptions: Record<string, any> = {
          resize: input.options?.resize,
          preserve: input.options?.preserveMetadata ? ["copyright", "creation", "location"] : [],
        };

        // 如果需要转换格式
        if (input.outputFormat !== input.mimeType) {
          apiOptions.convert = { type: input.outputFormat };
          console.log("Format conversion requested:", {
            from: input.mimeType,
            to: input.outputFormat,
            convertOptions: apiOptions.convert
          });
        }

        console.log("Sending to TinyPNG with options:", {
          bufferSize: imageBuffer.length,
          mimeType: input.mimeType,
          apiOptions: apiOptions
        });

        // 调用 TinyPNG API 时包含转换选项
        const response = await fetch("https://api.tinify.com/shrink", {
          method: "POST",
          body: imageBuffer,
          headers: {
            Authorization: `Basic ${Buffer.from(`api:${tinypngApiKey}`).toString("base64")}`,
            "Content-Type": input.mimeType,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("TinyPNG API error:", errorData);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: errorData.message || "Failed to compress image",
          });
        }

        const data = await response.json();
        console.log("TinyPNG initial response:", data);

        // 如果需要转换格式，发送第二个请求
        let finalUrl = data.output.url;
        if (apiOptions.convert) {
          console.log("Requesting format conversion with options:", apiOptions);
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
            console.error("Format conversion error:", {
              status: convertResponse.status,
              response: errorText,
              requestedOptions: apiOptions
            });
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Failed to convert image format",
            });
          }

          // 检查响应的 Content-Type
          const contentType = convertResponse.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            // 如果是 JSON 响应，解析它
            const convertData = await convertResponse.json();
            console.log("Format conversion success (JSON):", convertData);
            finalUrl = convertData.output.url;
          } else {
            // 如果是图片数据，直接使用这个响应
            console.log("Format conversion success (Binary):", {
              contentType,
              size: convertResponse.headers.get("content-length"),
            });
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

        // 如果没有直接返回图片数据，获取最终的图片
        const compressedImageResponse = await fetch(finalUrl);
        if (!compressedImageResponse.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch compressed image",
          });
        }

        const compressedImageBuffer = await compressedImageResponse.arrayBuffer();
        const compressedBase64 = Buffer.from(compressedImageBuffer).toString("base64");

        // 计算压缩比例和节省的空间
        const originalSize = imageBuffer.length;
        const compressedSize = data.output.size;
        const savedBytes = originalSize - compressedSize;
        const compressionRatio = Math.round((savedBytes / originalSize) * 100);

        const result = {
          success: true,
          originalSize,
          compressedSize,
          savedBytes,
          compressionRatio,
          compressedImage: `data:${input.mimeType};base64,${compressedBase64}`,
          originalType: input.mimeType,
          outputType: data.output.type || input.mimeType,
        };

        console.log("Returning result:", {
          ...result,
          compressedImage: `[base64 string length: ${result.compressedImage.length}]`
        });

        return result;

      } catch (error) {
        console.error("Compression error:", error);
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
