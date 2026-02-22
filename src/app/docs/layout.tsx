import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'API Documentation',
  description:
    'Fetchtium V2 API documentation for public media extraction endpoints, profile-aware platform support, and consistent JSON responses.',
  keywords: [
    'fetchtium api docs',
    'public media extractor api',
    'video extraction api',
    'social media metadata api',
    'rate limited public api',
  ],
  alternates: {
    canonical: '/docs',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Fetchtium V2 API Documentation',
    description:
      'Reference for extract, stream, download, merge, and status endpoints with deployment-aware capabilities.',
    url: '/docs',
    type: 'article',
  },
  twitter: {
    card: 'summary',
    title: 'Fetchtium V2 API Documentation',
    description:
      'Public API documentation with dynamic supported-platform profile behavior.',
  },
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return children;
}
