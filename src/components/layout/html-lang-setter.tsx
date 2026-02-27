"use client";

import { useEffect } from "react";

/**
 * Sets the <html lang> attribute to match the current locale.
 * Runs only on the client after hydration to avoid mismatch.
 */
export function HtmlLangSetter({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
