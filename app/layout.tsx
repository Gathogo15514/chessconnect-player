import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title:       "ChessConnect Player",
  description: "Your chess training portal — puzzles, assignments, and progress.",
  manifest:    "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ChessConnect" },
}

export const viewport: Viewport = {
  themeColor:   "#1B4D2E",
  width:        "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon"            href="/icons/icon-192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className="bg-stone-50 min-h-screen antialiased">
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
          }
        `}} />
      </body>
    </html>
  )
}
