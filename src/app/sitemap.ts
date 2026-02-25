import type { MetadataRoute } from 'next';

const rawBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
  ? process.env.NEXT_PUBLIC_BASE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://fetchtiumv2.up.railway.app';
const baseUrl = /^https?:\/\//i.test(rawBaseUrl) ? rawBaseUrl : `https://${rawBaseUrl}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/changelog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];
}
