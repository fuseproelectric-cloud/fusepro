import type React from "react";

export type ToastVariant = "default" | "destructive";
export type ToastProps = {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};
export type ToastActionElement = React.ReactNode;
