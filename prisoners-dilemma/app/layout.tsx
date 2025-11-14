import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prisoner's Dilemma Game",
  description: "Multiplayer Prisoner's Dilemma game built with Next.js and Socket.IO",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans"
      >
        {children}
      </body>
    </html>
  );
}
