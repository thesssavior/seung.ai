import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react"

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <Analytics />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-C64P1CEGZR"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-C64P1CEGZR');
          `}
        </Script>
        <link rel="icon" href="/seung_logo.png" type="image/png" />
      </head>
      <body className={`${inter.className} h-screen flex flex-col bg-background text-foreground`} suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}