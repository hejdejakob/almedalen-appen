import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/speakers',
          '/event',
          '/galtan',
          '/team',
          '/pensioner',
          '/arenaguiden',
          '/insikter',
          '/om',
          '/integritetspolicy',
          '/api/',
          '/og',
        ],
      },
    ],
    sitemap: 'https://almedalsdata.se/sitemap.xml',
  };
}
