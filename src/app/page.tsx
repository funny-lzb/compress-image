"use client";

import { api } from "~/trpc/react";
import { useState } from "react";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compressionResult, setCompressionResult] = useState<{
    originalSize: number;
    compressedSize: number;
    savedBytes: number;
    compressionRatio: number;
    compressedImage: string;
    originalType: string;
    outputType: string;
  } | null>(null);
  const [compressionOptions, setCompressionOptions] = useState({
    outputFormat: "image/webp",
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
      console.log("Compression successful:", data);
      setCompressionResult(data);
      setIsLoading(false);
      setStage("idle");
      setProgress(100);
    },
    onError: (error) => {
      console.error("Compression error:", error);
      setError(error.message);
      setIsLoading(false);
      setStage("idle");
    },
  });

  // 预处理大图片
  const preprocessImage = async (file: File): Promise<File> => {
    if (file.size <= 5 * 1024 * 1024) return file;

    try {
      const img = await createImageBitmap(file);
      const maxDim = 2048;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) throw new Error("Failed to get canvas context");

      ctx.drawImage(img, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b || file), file.type, 0.8),
      );

      return new File([blob], file.name, { type: file.type });
    } catch (error) {
      console.warn("Image preprocessing failed:", error);
      return file;
    }
  };

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

      const processedFile = await preprocessImage(file);
      console.log("File preprocessing:", {
        originalSize: formatFileSize(file.size),
        processedSize: formatFileSize(processedFile.size),
        preprocessed: processedFile !== file,
      });

      // 开始读取文件
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress((event.loaded / event.total) * 100);
          }
        };
        reader.readAsDataURL(processedFile);
      });

      // 开始压缩
      setStage("compressing");
      setProgress(0);

      // 使用 requestAnimationFrame 实现更平滑的进度动画
      let start: number | null = null;
      const duration = 3000; // 3秒动画

      const animate = (timestamp: number) => {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        const progress = Math.min((elapsed / duration) * 95, 95); // 最多到95%

        setProgress(progress);

        if (progress < 95) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);

      // 执行压缩
      await compressMutation.mutateAsync({
        imageBase64: base64,
        filename: processedFile.name,
        mimeType: processedFile.type,
        outputFormat: compressionOptions.outputFormat,
      });
    } catch (err) {
      console.error("Error:", err);
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

  // 渲染压缩结果
  const renderCompressionResults = () => {
    if (!uploadedFile) return null;

    return (
      <div className="mt-6 rounded-lg bg-gray-50 p-4">
        <h3 className="mb-4 font-semibold">Compression Results</h3>
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
                <p className="text-sm text-blue-600">
                  {stage === "uploading" && "Uploading..."}
                  {stage === "compressing" && "Optimizing..."}
                  {stage === "downloading" && "Downloading..."}
                </p>
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
    );
  };

  const handleOptionChange = (option: string, value: any) => {
    setCompressionOptions((prev) => ({
      ...prev,
      [option]: value,
    }));
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="flex w-full max-w-6xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
        {/* Left side content */}
        <div className="md:w-[45%]">
          <h1 className="mb-4 text-5xl font-bold text-black">
            Image Optimizer
          </h1>
          <p className="mb-6 text-xl text-gray-600">
            Optimize your images with lossless compression. Support PNG, JPEG,
            WebP and AVIF formats.
          </p>

          {/* Format selection */}
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold">Output Format</h2>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  id: "webp",
                  label: "WebP",
                  desc: "(Recommended)",
                  mime: "image/webp",
                },
                {
                  id: "avif",
                  label: "AVIF",
                  desc: "(Best compression)",
                  mime: "image/avif",
                },
                {
                  id: "png",
                  label: "PNG",
                  desc: "(Lossless)",
                  mime: "image/png",
                },
                {
                  id: "jpeg",
                  label: "JPEG",
                  desc: "(Photos)",
                  mime: "image/jpeg",
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
                  <span className="ml-1 text-xs opacity-75">{format.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Show compression results */}
          {renderCompressionResults()}
        </div>

        {/* Right side upload area */}
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
                  Processing your image...
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
                  Drop your image here
                </h2>
                <p className="mb-4 text-sm text-gray-500">
                  Supports PNG, JPEG, WebP • Up to 10MB
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
