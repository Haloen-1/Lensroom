import type { Metadata } from "next";
import "./globals.css";
import { SiteCopyProvider } from "./components/site-copy-provider";

export const metadata: Metadata = {
  title: "Lensroom",
  description: "An image-first portfolio with topic galleries and private photo labeling.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><SiteCopyProvider>{children}</SiteCopyProvider></body>
    </html>
  );
}
