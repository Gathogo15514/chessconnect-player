import type { Metadata, Viewport } from "next"
import "./globals.css"
import { DM_Sans, Playfair_Display } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
})
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["700", "800", "900"],
})

export const metadata: Metadata = {
  title:       "ChessLead Trainer",
  description: "Your personal chess training portal.",
  manifest:    "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ChessLead Trainer" },
}

export const viewport: Viewport = {
  themeColor:   "#0D1F0F",
  width:        "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable} antialiased`}>
      <head>
        <link rel="icon"             href="/icons/icon-192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className="font-sans" style={{ background: "var(--background)", minHeight: "100vh" }}>
        {children}
        <Toaster richColors position="top-right" />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
          }
        `}} />
      </body>
    </html>
  )
}
