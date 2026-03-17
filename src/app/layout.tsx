import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Container Hunter | ADB Solutions",
  description: "AI-powered geospatial intelligence for the container rental industry",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
