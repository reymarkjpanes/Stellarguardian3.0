"use client";

/**
 * Cloudflare Turnstile Widget (Phase 3, Task 3.3).
 *
 * Renders the invisible/managed Turnstile challenge.
 * On successful verification, calls `onVerify` with the token string.
 * The parent form includes this token in the submission payload
 * for server-side validation via `verifyTurnstileToken()`.
 *
 * If NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set (local dev), renders nothing.
 */
import { useEffect, useRef, useCallback } from "react";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "invisible";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export function TurnstileWidget({ onVerify, onExpire, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef(false);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || !siteKey) return;
    if (widgetIdRef.current) return; // Already rendered

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onVerify,
      "expired-callback": onExpire,
      "error-callback": onError,
      theme: "auto",
      size: "normal",
    });
  }, [siteKey, onVerify, onExpire, onError]);

  useEffect(() => {
    if (!siteKey) return;

    // If Turnstile script already loaded
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Load script once
    if (!scriptLoadedRef.current) {
      scriptLoadedRef.current = true;
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.onload = () => renderWidget();
      document.head.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, renderWidget]);

  // Don't render anything if site key not configured (dev mode)
  if (!siteKey) return null;

  return <div ref={containerRef} className="flex justify-center mt-2" />;
}
