import type { Metadata } from 'next'
import ScrollClient from './ScrollClient'

export const metadata: Metadata = {
  title: 'ClassMind - Scroll Mode',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
}

export default function ScrollPage() {
  return <ScrollClient />
}
