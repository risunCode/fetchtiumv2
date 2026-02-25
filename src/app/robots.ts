import type { MetadataRoute } from 'next';

const rawBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
  ? process.env.NEXT_PUBLIC_BASE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://fetchtiumv2.up.railway.app';
const baseUrl = /^https?:\/\//i.test(rawBaseUrl) ? rawBaseUrl : `https://${rawBaseUrl}`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
