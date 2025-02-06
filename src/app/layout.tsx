import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import Script from "next/script";

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
    google: "dFZuin9u5BNacxPrh9n9XbqolGofhDtxCjQOx6C2k9Q",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <head>
        {/* Google Analytics */}
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS}`}
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS}');
          `}
        </Script>
      </head>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        {process.env.NODE_ENV === "production" && <GoogleAnalytics />}
      </body>
    </html>
  );
}
