import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import GoogleAnalytics from "./(components)/GoogleAnalytics";

export const metadata: Metadata = {
  title: "WebP to PNG Converter | Free Online Image Compressor & Converter",
  description:
    "Convert WebP to PNG online instantly. Free tool to convert and compress images between WebP, PNG, JPEG formats. Best image compressor with no quality loss, no file size limits, no registration required.",
  openGraph: {
    title: "WebP to PNG Converter | Free Online Image Compressor & Converter",
    description:
      "Convert WebP to PNG online instantly. Free tool to convert and compress images between WebP, PNG, JPEG formats. Best quality compression with no limits.",
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
        {process.env.NODE_ENV === "production" && <GoogleAnalytics />}
      </body>
    </html>
  );
}
