import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "WhatsBridge · Developer platform",
  description: "Consent-first messaging infrastructure for your applications.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
