import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stellar Guardian",
  description: "Host and join decentralized events backed by Stellar escrow security.",
};

/**
 * Inline script to set the theme class before paint, preventing flash.
 * Reads from localStorage and applies .dark or .light immediately.
 */
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      var resolved = theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.classList.add(resolved);
    } catch(e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
