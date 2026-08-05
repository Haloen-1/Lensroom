import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
