"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { upload } from "@vercel/blob/client";

type ImageMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/jpg"
  | "image/webp"
  | "image/avif";

interface CompressionResult {
  success: boolean;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  compressionRatio: number;
  compressedImage: string;
  originalType: string;
  outputType: string;
}

interface ApiErrorResponse {
  error: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// 自定义 FAQ 组件
const FAQItem = ({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50"
      >
        <h3 className="text-lg font-medium text-gray-900">{question}</h3>
        <svg
          className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p
            className="p-4 text-gray-600"
            dangerouslySetInnerHTML={{ __html: answer }}
          />
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compressionResult, setCompressionResult] =
    useState<CompressionResult | null>(null);
  const [compressionOptions, setCompressionOptions] = useState({
    outputFormat: "image/png" as ImageMimeType,
  });
  const [uploadedFile, setUploadedFile] = useState<{
    size: number;
    type: string;
  } | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [stage, setStage] = useState<
    "idle" | "uploading" | "compressing" | "downloading"
  >("idle");

  const compressMutation = api.compress.compress.useMutation({
    onSuccess: (data) => {
      setCompressionResult(data);
      setIsLoading(false);
      setStage("idle");
      setProgress(100);
    },
    onError: (error) => {
      setError(error.message);
      setIsLoading(false);
      setStage("idle");
    },
  });

  const handleFileSelect = async (file: File) => {
    try {
      setIsLoading(true);
      setError(null);
      setProgress(0);
      setStage("uploading");

      setUploadedFile({
        size: file.size,
        type: file.type,
      });

      // 验证文件类型
      if (!SUPPORTED_MIME_TYPES.includes(file.type as ImageMimeType)) {
        throw new Error(
          "Unsupported file type. Please upload a PNG, JPEG, or WebP image.",
        );
      }

      // 验证文件大小
      if (file.size > 10 * 1024 * 1024) {
        // 10MB
        throw new Error(
          "File size too large. Please upload an image smaller than 10MB.",
        );
      }

      // 上传文件到 Vercel Blob
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        onUploadProgress: (progressEvent: unknown) => {
          // 上传阶段占总进度的 30%
          const progress = progressEvent as { loaded: number; total: number };
          const uploadPercentage = (progress.loaded / progress.total) * 30;
          if (!isNaN(uploadPercentage)) {
            setProgress(uploadPercentage);
          }
        },
      });

      // 开始压缩
      setStage("compressing");

      // 调整时间范围到 15-20 秒
      const startTime = Date.now();
      const minTime = 15000; // 15秒
      const maxTime = 20000; // 20秒
      const targetProgress = 99;

      let animationFrame: number;

      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(
          30 + // 上传阶段结束时的进度
            (elapsed / minTime) * 69, // 剩余69%在最小时间内分配
          targetProgress,
        );

        setProgress(progress);

        if (elapsed < maxTime && progress < targetProgress) {
          animationFrame = requestAnimationFrame(updateProgress);
        }
      };

      // 开始进度条动画
      animationFrame = requestAnimationFrame(updateProgress);

      // 调用新的压缩 API
      const response = await fetch("/api/compress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: blob.url,
          filename: file.name,
          mimeType: file.type as ImageMimeType,
          outputFormat: compressionOptions.outputFormat,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ApiErrorResponse;
        throw new Error(errorData.error || "Failed to compress image");
      }

      const result = (await response.json()) as CompressionResult;

      // 验证结果包含所有必需的字段
      if (
        !result.compressedImage ||
        typeof result.originalSize !== "number" ||
        typeof result.compressedSize !== "number"
      ) {
        throw new Error("Invalid compression result received");
      }

      // 取消进度条动画
      cancelAnimationFrame(animationFrame);

      setCompressionResult(result);
      setIsLoading(false);
      setStage("idle");
      setProgress(100);
    } catch (err) {
      console.error("File processing error:", err);
      setError(err instanceof Error ? err.message : "Failed to process file");
      setIsLoading(false);
      setStage("idle");
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) await handleFileSelect(file);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileSelect(file);
  };

  const handleOptionChange = (option: "outputFormat", value: ImageMimeType) => {
    setCompressionOptions((prev) => ({
      ...prev,
      [option]: value,
    }));
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="flex w-full max-w-6xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="md:w-[45%]">
            <h1 className="mb-4 text-5xl font-bold text-black">
              WebP to PNG Converter
            </h1>
            <p className="mb-6 text-xl text-gray-600">
              Free online tool to convert WebP images to PNG format. No
              registration required, instant conversion with original quality
              maintained.
            </p>

            <div className="mb-6">
              <h2 className="mb-3 text-lg font-semibold">
                Choose Output Format
              </h2>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    id: "webp",
                    label: "WebP",
                    desc: "(Recommended for web)",
                    mime: "image/webp" as ImageMimeType,
                  },
                  {
                    id: "avif",
                    label: "AVIF",
                    desc: "(Best compression)",
                    mime: "image/avif" as ImageMimeType,
                  },
                  {
                    id: "png",
                    label: "PNG",
                    desc: "(Lossless quality)",
                    mime: "image/png" as ImageMimeType,
                  },
                  {
                    id: "jpeg",
                    label: "JPEG",
                    desc: "(Best for photos)",
                    mime: "image/jpeg" as ImageMimeType,
                  },
                ].map((format) => (
                  <button
                    key={format.id}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      compressionOptions.outputFormat === format.mime
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                    onClick={() =>
                      handleOptionChange("outputFormat", format.mime)
                    }
                  >
                    {format.label}
                    <span className="ml-1 text-xs opacity-75">
                      {format.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {uploadedFile && (
              <div className="mt-6 rounded-lg bg-gray-50 p-4">
                <h3 className="mb-4 font-semibold">
                  Image Compression Results
                </h3>
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Original</p>
                    <p className="text-lg font-medium">
                      {formatFileSize(uploadedFile.size)}
                    </p>
                    <p className="text-xs uppercase text-gray-500">
                      {uploadedFile.type.split("/")[1]}
                    </p>
                  </div>
                  <div className="px-4">
                    <svg
                      className="h-6 w-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Compressed</p>
                    {isLoading ? (
                      <div className="flex flex-col items-center">
                        <div className="mb-2">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-blue-600 transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {Math.round(progress)}%
                          </p>
                        </div>
                      </div>
                    ) : (
                      compressionResult && (
                        <>
                          <p className="text-lg font-medium text-green-600">
                            {formatFileSize(compressionResult.compressedSize)}
                          </p>
                          <p className="text-xs uppercase text-gray-500">
                            {compressionResult.outputType.split("/")[1]}
                          </p>
                        </>
                      )
                    )}
                  </div>
                </div>

                {compressionResult && !isLoading && (
                  <a
                    href={compressionResult.compressedImage}
                    download={`optimized.${compressionResult.outputType.split("/")[1]}`}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download Optimized Image
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="md:w-[45%]">
            <div
              className={`rounded-xl border-2 border-dashed ${
                isLoading
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-300 bg-gray-50"
              } p-12 text-center transition-colors hover:border-blue-500`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {isLoading ? (
                <>
                  <div className="mb-4 flex justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
                  </div>
                  <h2 className="mb-2 text-xl font-medium text-blue-600">
                    Processing Your Image...
                  </h2>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <h2 className="mb-2 text-xl font-medium">
                    Upload Your Image
                  </h2>
                  <p className="mb-4 text-sm text-gray-500">
                    Supports PNG, JPEG, WebP • Free • No Registration Required
                  </p>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileInput}
                    className="hidden"
                    id="fileInput"
                  />
                  <label
                    htmlFor="fileInput"
                    className="inline-flex cursor-pointer items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Select Image
                  </label>
                </>
              )}
              {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full bg-white px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          <section className="mb-40">
            <h2 className="mb-8 text-3xl font-semibold text-black">
              Popular Image Conversions
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:border-blue-100 hover:shadow-lg">
                <h3 className="mb-3 text-2xl font-medium text-gray-900">
                  WebP to PNG
                </h3>
                <p className="text-gray-600">
                  Convert WebP images to PNG format while maintaining original
                  quality. Perfect for when you need maximum compatibility.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:border-blue-100 hover:shadow-lg">
                <h3 className="mb-3 text-2xl font-medium text-gray-900">
                  PNG to WebP
                </h3>
                <p className="text-gray-600">
                  Transform PNG images to WebP format to reduce file size while
                  maintaining high quality. Ideal for web optimization.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:border-blue-100 hover:shadow-lg">
                <h3 className="mb-3 text-2xl font-medium text-gray-900">
                  JPEG to WebP
                </h3>
                <p className="text-gray-600">
                  Convert JPEG images to WebP format for better compression and
                  web performance.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="mb-6 text-3xl font-semibold text-black">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {[
                {
                  question: "How to Convert WebP to PNG?",
                  answer:
                    "1. Select the PNG (Lossless quality) tab<br/><br/>" +
                    "2. Click the 'Select Image' button in the file upload box to upload your image<br/><br/>" +
                    "Wait for 5-10 seconds (depending on the size of your image and conversion format), then click the 'Download Optimized Image' button to download your converted image",
                },
                {
                  question: "What is WebP Format?",
                  answer:
                    "WebP is Google's modern image format offering superior compression for web images. It provides both lossless and lossy compression, making it ideal for web graphics.",
                },
                {
                  question: "Why Choose Our Converter?",
                  answer:
                    "Our converter processes files locally in your browser, ensuring privacy. It's completely free, with no watermarks, no quality loss, and no file size limits.",
                },
                {
                  question: "Is it Free to Use?",
                  answer:
                    "Yes, our WebP to PNG converter is completely free to use. There are no hidden fees, no registration required, and no limitations on file sizes or number of conversions.",
                },
                {
                  question: "What's the Difference Between WebP and PNG?",
                  answer:
                    "WebP offers better compression than PNG while maintaining similar quality. However, PNG has wider compatibility and is preferred when lossless quality is essential.",
                },
                {
                  question: "Are There Any File Size Limits?",
                  answer:
                    "No, there are no file size limits. However, for optimal performance, files larger than 5MB will be automatically optimized before conversion.",
                },
              ].map((faq, index) => (
                <FAQItem
                  key={index}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold text-black">
              Friendly Links
            </h2>
            <div className="flex gap-6">
              <a
                href="https://basketballbros.net/"
                target="_blank"
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                Basketball bros
              </a>
              <a
                href="https://narrow-one.net/"
                target="_blank"
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                Narrow one
              </a>
              <a
                href="https://football-bros.net/"
                target="_blank"
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                Football bros
              </a>
              <a
                href="https://sand-tetris.online/"
                target="_blank"
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                Sand tetris
              </a>
              <a
                href="https://gemma-3.net"
                target="_blank"
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                gemma 3
              </a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

// Add progress bar animation
const styles = `
  @keyframes progress {
    0% { transform: translateX(-100%); }
    50% { transform: translateX(0); }
    100% { transform: translateX(100%); }
  }
  .animate-progress {
    animation: progress 2s infinite linear;
  }
`;

// Add styles to the page
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

// 添加支持的 MIME 类型常量
const SUPPORTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/avif",
] as const;
