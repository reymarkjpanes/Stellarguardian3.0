/**
 * useFormDraft — localStorage-based form draft persistence (M15).
 *
 * Automatically saves form state to localStorage on change and restores
 * it on mount. Provides a `clearDraft` function to remove saved state
 * after successful submission.
 *
 * Usage:
 *   const [title, setTitle] = useDraft("create-event", "title", "");
 *   // On submit success: clearDraft("create-event");
 */
"use client";

import { useState, useEffect, useCallback } from "react";

const PREFIX = "sg-draft:";

/**
 * Hook for a single form field with draft persistence.
 */
export function useFormDraft<T>(
  formKey: string,
  fieldKey: string,
  initialValue: T,
): [T, (value: T) => void] {
  const storageKey = `${PREFIX}${formKey}:${fieldKey}`;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (value === initialValue || value === "" || value === null) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(value));
      }
    } catch {
      // localStorage unavailable (private browsing, quota exceeded)
    }
  }, [value, storageKey, initialValue]);

  return [value, setValue];
}

/**
 * Clear all drafts for a form key.
 */
export function clearDraft(formKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const prefix = `${PREFIX}${formKey}:`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Silently fail
  }
}

/**
 * Check if a form has any saved drafts.
 */
export function hasDraft(formKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const prefix = `${PREFIX}${formKey}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) return true;
    }
  } catch {
    // Silently fail
  }
  return false;
}

/**
 * Hook for entire form object draft persistence.
 * Saves the full object as one entry.
 */
export function useFormObjectDraft<T extends Record<string, unknown>>(
  formKey: string,
  initialValue: T,
): [T, (value: T) => void, () => void] {
  const storageKey = `${PREFIX}${formKey}`;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? { ...initialValue, ...JSON.parse(stored) } : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      const hasValues = Object.values(value).some((v) => v !== "" && v !== null && v !== undefined);
      if (hasValues) {
        localStorage.setItem(storageKey, JSON.stringify(value));
      }
    } catch {
      // Silently fail
    }
  }, [value, storageKey]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Silently fail
    }
  }, [storageKey]);

  return [value, setValue, clear];
}
