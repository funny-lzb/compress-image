import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Online Image Compressor | Free WebP, AVIF, PNG, JPEG Optimizer",
  description:
    "Free online image compressor that reduces image size without losing quality. Convert and compress images to WebP, AVIF, PNG, or JPEG format. No upload limits, no registration required.",
  keywords: [
    "online image compressor",
    "free image compressor",
    "image optimizer",
    "webp converter",
    "avif converter",
    "compress images online",
    "reduce image size",
    "image compression tool",
    "photo optimizer",
    "picture compressor",
  ],
  openGraph: {
    title: "Online Image Compressor | Free WebP, AVIF, PNG, JPEG Optimizer",
    description:
      "Free online tool to compress and optimize your images. Support WebP, AVIF, PNG, and JPEG formats with best compression ratio.",
  },
  icons: [{ rel: "icon", url: "/icon.png" }],
  verification: {
    google: "1f-luF6aIQTixAwaiwFrNX-kJvPG-gI43ubIISoYGKc",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
