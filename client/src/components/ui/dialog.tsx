import React from "react";
import MuiDialog, { DialogProps as MuiDialogProps } from "@mui/material/Dialog";
import MuiDialogTitle from "@mui/material/DialogTitle";
import MuiDialogContent from "@mui/material/DialogContent";
import MuiDialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import { X } from "lucide-react";

/* ─── Dialog root ─────────────────────────────────────────────────────────── */
export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  maxWidth?: MuiDialogProps["maxWidth"];
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export function Dialog({ open, onOpenChange, maxWidth = "sm", fullWidth = true, children }: DialogProps) {
  return (
    <MuiDialog
      open={!!open}
      onClose={() => onOpenChange?.(false)}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      PaperProps={{ sx: { borderRadius: "10px", maxHeight: "90vh" } }}
    >
      {children}
    </MuiDialog>
  );
}

/* ─── DialogContent ────────────────────────────────────────────────────────── */
export interface DialogContentProps {
  children?: React.ReactNode;
  noPadding?: boolean;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}

export function DialogContent({ children, noPadding, className: _c, style: _s, ...rest }: DialogContentProps) {
  const muiProps = Object.fromEntries(
    Object.entries(rest).filter(([k]) => !k.startsWith("on") || ["onScroll"].includes(k))
  );
  return (
    <MuiDialogContent
      dividers={false}
      sx={noPadding ? { p: 0, "&:first-of-type": { pt: 0 } } : { pt: 1 }}
      {...muiProps as any}
    >
      {children}
    </MuiDialogContent>
  );
}

/* ─── DialogTitle ──────────────────────────────────────────────────────────── */
export interface DialogTitleProps {
  children?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  [key: string]: unknown;
}

export function DialogTitle({ children, onClose, className: _c, ...rest }: DialogTitleProps) {
  return (
    <MuiDialogTitle
      sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: onClose ? 6 : undefined }}
    >
      {children}
      {onClose && (
        <IconButton
          aria-label="close"
          onClick={onClose}
          size="small"
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <X size={16} />
        </IconButton>
      )}
    </MuiDialogTitle>
  );
}

/* ─── DialogHeader ─────────────────────────────────────────────────────────── */
export function DialogHeader({ children, className: _c }: { children?: React.ReactNode; className?: string }) {
  return <>{children}</>;
}

/* ─── DialogFooter ─────────────────────────────────────────────────────────── */
export function DialogFooter({ children, className: _className }: { children?: React.ReactNode; className?: string }) {
  return (
    <MuiDialogActions sx={{ px: 3, pb: 2 }}>
      {children}
    </MuiDialogActions>
  );
}

/* ─── DialogDescription ────────────────────────────────────────────────────── */
export function DialogDescription({ children, className: _className }: { children?: React.ReactNode; className?: string }) {
  return <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>{children}</p>;
}

/* ─── Re-exports for Radix-compatible callers ──────────────────────────────── */
export const DialogTrigger = (_props: { children?: React.ReactNode; asChild?: boolean }) => null;
export const DialogPortal  = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const DialogOverlay = (_props: { className?: string }) => null;
export const DialogClose   = ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
  <span onClick={onClick}>{children}</span>
);
