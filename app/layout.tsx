import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BarStory — карта городских баров",
  description: "Городская игра: посещайте бары и отмечайте их на карте.",
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
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
