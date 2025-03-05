import type { Metadata } from "next";
import "./globals.css";
import { GameProvider } from "@/context";

export const metadata: Metadata = {
  title: "Ethereal Arena",
  description: "A web-based card battling game with LLM-generated cards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <GameProvider>
          {children}
        </GameProvider>
      </body>
    </html>
  );
}
