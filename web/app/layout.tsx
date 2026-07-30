import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/use-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stellar Guardian",
  description: "Host and join decentralized events backed by Stellar escrow security.",
};

/**
 * Inline script to set the theme class before paint, preventing flash.
 * Reads from localStorage and applies .dark or .light immediately.
 * Default: dark (when no preference is stored).
 */
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      var resolved = theme === 'light' ? 'light' : theme === 'dark' ? 'dark' : 'dark';
      document.documentElement.classList.add(resolved);
    } catch(e) {
      document.documentElement.classList.add('dark');
    }
  })();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The nonce is handled automatically by Next.js for <Script> tags
  // when x-nonce is set in the middleware.

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          id="theme-script"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {/* Skip to content — WCAG 2.4.1 Bypass Blocks */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-md focus:bg-[var(--btn-primary-bg)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--btn-primary-text)]"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
