import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Fetchtium - Media Extraction Tool',
  description: 'Extract videos, images, and audio from Facebook, Instagram, TikTok, and more. Fast, free, and easy to use.',
  keywords: ['video downloader', 'media extractor', 'facebook video', 'instagram video', 'tiktok video'],
  authors: [{ name: 'risunCode', url: 'https://github.com/risunCode' }],
  creator: 'risunCode',
  publisher: 'Downaria',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'Fetchtium - Media Extraction Tool',
    description: 'Extract videos, images, and audio from social media platforms.',
    siteName: 'Fetchtium',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fetchtium - Media Extraction Tool',
    description: 'Extract videos, images, and audio from social media platforms.',
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon-512.png',
  },
  manifest: '/manifest.json',
  other: {
    'link:author': 'https://github.com/risunCode',
    'link:publisher': 'https://downaria.vercel.app',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#000000',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-black text-zinc-100`}>
        {children}
      </body>
    </html>
  );
}
