import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const maxDuration = 60; // 1分钟，通常足够完成大多数生成任务


const SUPPORTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/avif'
] as const;

const compressionSchema = z.object({
  imageUrl: z.string().url(),
  filename: z.string(),
  mimeType: z.enum(SUPPORTED_MIME_TYPES),
  outputFormat: z.enum(SUPPORTED_MIME_TYPES),
});

interface TinyPNGResponse {
  input: {
    size: number;
    type: string;
  };
  output: {
    size: number;
    type: string;
    width: number;
    height: number;
    ratio: number;
    url: string;
  };
}

const tinypngApiKey = process.env.TINY_PNG_API_KEY;

if (!tinypngApiKey) {
  throw new Error("TINY_PNG_API_KEY is not set");
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json();
    const validatedInput = compressionSchema.parse(input);
    
    // 获取图片数据
    const imageResponse = await fetch(validatedInput.imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: 400 }
      );
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();

    // TinyPNG API 调用
    const response = await fetch("https://api.tinify.com/shrink", {
      method: "POST",
      body: Buffer.from(imageBuffer),
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${tinypngApiKey}`).toString("base64")}`,
        "Content-Type": validatedInput.mimeType,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || "Failed to compress image" },
        { status: 400 }
      );
    }

    const data = await response.json() as TinyPNGResponse;
    
    // 如果需要转换格式
    if (validatedInput.outputFormat !== validatedInput.mimeType) {
      const convertResponse = await fetch(data.output.url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${tinypngApiKey}`).toString("base64")}`,
        },
      });

      if (!convertResponse.ok) {
        return NextResponse.json(
          { error: "Failed to convert image format" },
          { status: 400 }
        );
      }

      // 直接获取二进制数据
      const compressedImageBuffer = await convertResponse.arrayBuffer();
      const compressedBase64 = Buffer.from(compressedImageBuffer).toString("base64");

      return NextResponse.json({
        success: true,
        originalSize: imageBuffer.byteLength,
        compressedSize: compressedImageBuffer.byteLength,
        savedBytes: Math.max(0, imageBuffer.byteLength - compressedImageBuffer.byteLength),
        compressionRatio: Math.round(((imageBuffer.byteLength - compressedImageBuffer.byteLength) / imageBuffer.byteLength) * 100),
        compressedImage: `data:${validatedInput.outputFormat};base64,${compressedBase64}`,
        originalType: validatedInput.mimeType,
        outputType: validatedInput.outputFormat,
      });
    }

    // 如果不需要转换格式，直接获取压缩后的图片
    const compressedImageResponse = await fetch(data.output.url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${tinypngApiKey}`).toString("base64")}`,
      },
    });

    if (!compressedImageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch compressed image" },
        { status: 400 }
      );
    }

    const compressedImageBuffer = await compressedImageResponse.arrayBuffer();
    const compressedBase64 = Buffer.from(compressedImageBuffer).toString("base64");

    return NextResponse.json({
      success: true,
      originalSize: imageBuffer.byteLength,
      compressedSize: compressedImageBuffer.byteLength,
      savedBytes: Math.max(0, imageBuffer.byteLength - compressedImageBuffer.byteLength),
      compressionRatio: Math.round(((imageBuffer.byteLength - compressedImageBuffer.byteLength) / imageBuffer.byteLength) * 100),
      compressedImage: `data:${validatedInput.mimeType};base64,${compressedBase64}`,
      originalType: validatedInput.mimeType,
      outputType: validatedInput.mimeType,
    });

  } catch (error) {
    console.error("Compression error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process image" },
      { status: 500 }
    );
  }
}

// 增加响应大小限制
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '10mb',
  },
};