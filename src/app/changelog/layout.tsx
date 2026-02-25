import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Release notes for Fetchtium V2: extractor updates, deployment profile behavior, and API changes.',
  keywords: [
    'fetchtium changelog',
    'fetchtium releases',
    'media extractor updates',
    'api release notes',
  ],
  alternates: {
    canonical: '/changelog',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Fetchtium V2 Changelog',
    description: 'Track feature updates, API changes, and fixes in Fetchtium V2.',
    url: '/changelog',
    type: 'article',
  },
  twitter: {
    card: 'summary',
    title: 'Fetchtium V2 Changelog',
    description: 'Release notes and update history for Fetchtium V2.',
  },
};

export default function ChangelogLayout({ children }: { children: ReactNode }) {
  return children;
}
