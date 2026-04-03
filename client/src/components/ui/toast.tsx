/**
 * Toast — uses Atlantis showToast. Keeps shadcn toast API shape.
 */
import React from "react";
import { showToast } from "@jobber/components/Toast";

export type ToastVariant = "default" | "destructive";
export type ToastProps = { title?: string; description?: string; variant?: ToastVariant; open?: boolean; onOpenChange?: (open: boolean) => void };
export type ToastActionElement = React.ReactNode;

export function toast({ title, description, variant }: {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}) {
  const message = [title, description].filter(Boolean).join(": ") || "Notification";
  showToast({
    message,
    variation: variant === "destructive" ? "error" : "success",
  });
}

// Re-export for components that import toast hooks
export { toast as useToast };
export default toast;
