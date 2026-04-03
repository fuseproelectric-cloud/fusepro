import { Snackbar, Alert, AlertTitle } from "@mui/material";
import { useToast } from "@/hooks/use-toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const toast = toasts[0];

  if (!toast) return null;

  const severity = toast.variant === "destructive" ? "error" : "success";

  return (
    <Snackbar
      open={toast.open ?? false}
      autoHideDuration={4000}
      onClose={() => dismiss(toast.id)}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      <Alert severity={severity} onClose={() => dismiss(toast.id)} variant="filled">
        {toast.title && <AlertTitle sx={{ mb: toast.description ? 0.25 : 0 }}>{toast.title}</AlertTitle>}
        {toast.description}
      </Alert>
    </Snackbar>
  );
}
