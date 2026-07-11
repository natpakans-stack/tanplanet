import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import './globals.css';

const plexThai = IBM_Plex_Sans_Thai({
  weight: ['400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'หารกัน — หารบิลทริปกับเพื่อน',
  description: 'เปิด Project, ชวนเพื่อนสแกน QR เข้ามา แล้วหารบิลทริปกัน รู้เลยว่าใครต้องโอนใครเท่าไหร่',
};

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={plexThai.className}>{children}</body>
    </html>
  );
}
