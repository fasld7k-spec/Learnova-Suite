import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Learnova Suite',
    short_name: 'Learnova',
    description: 'Education SaaS marketplace for courses, live classes, certificates, and instructor sales.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
