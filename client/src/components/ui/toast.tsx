/**
 * Toast — uses Atlantis showToast. Keeps shadcn toast API shape.
 */
import { showToast } from "@jobber/components/Toast";

export type ToastVariant = "default" | "destructive";

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
