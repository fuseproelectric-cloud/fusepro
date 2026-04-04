import { createTheme, alpha } from "@mui/material/styles";
import type { Shadows } from "@mui/material/styles";

// ── Design token → hex mappings ───────────────────────────────────────────────
// Source: client/src/index.css CSS custom properties (HSL → hex conversion)
const C = {
  primary:         "#2563EB",  // --primary:          221 83% 53%
  primaryDark:     "#1D4ED8",  // --primary-hover:     221 83% 46%
  primaryLight:    "#3B82F6",  // lightened primary
  background:      "#F0F2F5",  // --background:        220 14% 96%
  paper:           "#FFFFFF",  // --card:              0 0% 100%
  textPrimary:     "#1A2333",  // --foreground:        215 25% 12%
  textSecondary:   "#64748B",  // --muted-foreground:  215 16% 47%
  textDisabled:    "#9DAABF",  // midpoint, readable but muted
  divider:         "#D9DCE6",  // --border:            220 13% 88%
  error:           "#DC2626",  // --destructive:       4 74%  49%
  warning:         "#D97706",  // amber-600
  success:         "#16A34A",  // green-600
  successLight:    "#4ADE80",  // green-400 — used for online indicator
  muted:           "#EEF0F4",  // --muted:             220 13% 94%
  accentBg:        "#EBF5FF",  // --accent:            214 100% 95%
  accentText:      "#1E40AF",  // --accent-foreground  221 83% 35%
} as const;

// ── Shadows ───────────────────────────────────────────────────────────────────
const shadowLow  = "0 1px 2px rgba(0,0,0,.08), 0 0 1px rgba(0,0,0,.10)";
const shadowBase = "0 2px 8px rgba(0,0,0,.08), 0 0 1px rgba(0,0,0,.06)";
const shadowHigh = "0 8px 24px rgba(0,0,0,.10), 0 0 1px rgba(0,0,0,.06)";

// MUI requires exactly 25 shadow entries (indices 0–24)
const shadows: Shadows = [
  "none",       // 0 — flat
  shadowLow,    // 1 — cards, panels
  shadowLow,    // 2
  shadowLow,    // 3
  shadowBase,   // 4 — AppBar
  shadowBase,   // 5
  shadowBase,   // 6
  shadowBase,   // 7
  shadowBase,   // 8 — menus, popovers
  shadowBase,   // 9
  shadowBase,   // 10
  shadowBase,   // 11
  shadowBase,   // 12
  shadowBase,   // 13
  shadowBase,   // 14
  shadowBase,   // 15
  shadowHigh,   // 16 — Drawer
  shadowHigh,   // 17
  shadowHigh,   // 18
  shadowHigh,   // 19
  shadowHigh,   // 20
  shadowHigh,   // 21
  shadowHigh,   // 22
  shadowHigh,   // 23
  shadowHigh,   // 24 — Dialog
];

export const muiTheme = createTheme({
  // ── Palette ──────────────────────────────────────────────────────────────────
  palette: {
    mode: "light",
    primary: {
      main:  C.primary,
      dark:  C.primaryDark,
      light: C.primaryLight,
      contrastText: "#FFFFFF",
    },
    error: {
      main: C.error,
      contrastText: "#FFFFFF",
    },
    warning: {
      main: C.warning,
      contrastText: "#FFFFFF",
    },
    success: {
      main:  C.success,
      light: C.successLight,
      contrastText: "#FFFFFF",
    },
    background: {
      default: C.background,
      paper:   C.paper,
    },
    text: {
      primary:   C.textPrimary,
      secondary: C.textSecondary,
      disabled:  C.textDisabled,
    },
    divider: C.divider,
    action: {
      // Subtle hover/selected states that work on white paper
      hover:           alpha(C.primary, 0.06),
      hoverOpacity:    0.06,
      selected:        alpha(C.primary, 0.10),
      selectedOpacity: 0.10,
      focus:           alpha(C.primary, 0.12),
      focusOpacity:    0.12,
      disabled:        alpha(C.textPrimary, 0.38),
      disabledBackground: alpha(C.textPrimary, 0.12),
    },
  },

  // ── Typography ───────────────────────────────────────────────────────────────
  // Base: 14px (set on <html> in index.css), Inter
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 14,
    htmlFontSize: 14,
    fontWeightLight:   300,
    fontWeightRegular: 400,
    fontWeightMedium:  500,
    fontWeightBold:    700,
    h1: { fontSize: "1.75rem",   fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em" },
    h2: { fontSize: "1.5rem",    fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.015em" },
    h3: { fontSize: "1.25rem",   fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em" },
    h4: { fontSize: "1.125rem",  fontWeight: 600, lineHeight: 1.35 },
    h5: { fontSize: "1rem",      fontWeight: 600, lineHeight: 1.4 },
    h6: { fontSize: "0.9375rem", fontWeight: 600, lineHeight: 1.4 },
    subtitle1: { fontSize: "0.9375rem", fontWeight: 500, lineHeight: 1.5 },
    subtitle2: { fontSize: "0.875rem",  fontWeight: 500, lineHeight: 1.5 },
    body1:  { fontSize: "0.9375rem", fontWeight: 400, lineHeight: 1.6 },
    body2:  { fontSize: "0.875rem",  fontWeight: 400, lineHeight: 1.6 },
    caption: { fontSize: "0.75rem",  fontWeight: 400, lineHeight: 1.5 },
    overline: { fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" },
    button:  { fontSize: "0.875rem", fontWeight: 600, textTransform: "none", letterSpacing: "0.01em" },
  },

  // ── Shape ────────────────────────────────────────────────────────────────────
  shape: {
    borderRadius: 8,
  },

  // ── Shadows ──────────────────────────────────────────────────────────────────
  shadows,

  // ── Spacing ──────────────────────────────────────────────────────────────────
  // Default 8px base — spacing(1) = 8px, spacing(0.5) = 4px, etc.
  spacing: 8,

  // ── Component overrides ──────────────────────────────────────────────────────
  components: {

    // ── Button ──────────────────────────────────────────────────────────────────
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          textTransform: "none",
          letterSpacing: "0.01em",
          "&.Mui-disabled": {
            opacity: 0.5,
          },
        },
        sizeSmall:  { height: 32, fontSize: "0.8125rem", padding: "0 12px" },
        sizeMedium: { height: 38, fontSize: "0.875rem",  padding: "0 16px" },
        sizeLarge:  { height: 44, fontSize: "0.9375rem", padding: "0 20px" },
        containedPrimary: {
          "&:hover": { backgroundColor: C.primaryDark },
        },
        outlinedPrimary: {
          borderColor: alpha(C.primary, 0.5),
          "&:hover": {
            borderColor: C.primary,
            backgroundColor: alpha(C.primary, 0.06),
          },
        },
      },
    },

    // ── IconButton ───────────────────────────────────────────────────────────────
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "&:hover": {
            backgroundColor: alpha(C.textPrimary, 0.06),
          },
        },
        sizeSmall:  { padding: 4 },
        sizeMedium: { padding: 8 },
      },
    },

    // ── TextField ────────────────────────────────────────────────────────────────
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        size: "small",
      },
    },

    // ── OutlinedInput ────────────────────────────────────────────────────────────
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: C.paper,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: C.divider,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha(C.primary, 0.5),
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: C.primary,
            borderWidth: 1.5,
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: C.error,
          },
        },
        sizeSmall: {
          "& .MuiOutlinedInput-input": {
            paddingTop: "8px",
            paddingBottom: "8px",
            fontSize: "0.875rem",
          },
        },
        input: {
          fontSize: "0.875rem",
          color: C.textPrimary,
          "&::placeholder": {
            color: C.textSecondary,
            opacity: 1,
          },
        },
      },
    },

    // ── InputLabel ───────────────────────────────────────────────────────────────
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: "0.875rem",
          color: C.textSecondary,
          "&.Mui-focused": {
            color: C.primary,
          },
          "&.Mui-error": {
            color: C.error,
          },
        },
        sizeSmall: {
          fontSize: "0.8125rem",
        },
      },
    },

    // ── Select ───────────────────────────────────────────────────────────────────
    MuiSelect: {
      defaultProps: {
        size: "small",
      },
      styleOverrides: {
        select: {
          fontSize: "0.875rem",
        },
      },
    },

    // ── MenuItem ─────────────────────────────────────────────────────────────────
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: "0.875rem",
          minHeight: 36,
          borderRadius: 4,
          mx: 4,
          "&.Mui-selected": {
            backgroundColor: alpha(C.primary, 0.10),
            "&:hover": {
              backgroundColor: alpha(C.primary, 0.14),
            },
          },
          "&:hover": {
            backgroundColor: alpha(C.textPrimary, 0.06),
          },
        },
      },
    },

    // ── Paper ────────────────────────────────────────────────────────────────────
    MuiPaper: {
      defaultProps: {
        elevation: 1,
      },
      styleOverrides: {
        root: {
          backgroundImage: "none", // disable MUI's default gradient on dark mode
        },
        outlined: {
          borderColor: C.divider,
        },
        elevation1: {
          boxShadow: shadowLow,
        },
        elevation4: {
          boxShadow: shadowBase,
        },
        elevation8: {
          boxShadow: shadowBase,
        },
        elevation16: {
          boxShadow: shadowHigh,
        },
        elevation24: {
          boxShadow: shadowHigh,
        },
      },
    },

    // ── Card ─────────────────────────────────────────────────────────────────────
    MuiCard: {
      defaultProps: {
        elevation: 1,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          border: `1px solid ${C.divider}`,
          boxShadow: shadowLow,
        },
      },
    },

    // ── CardContent ──────────────────────────────────────────────────────────────
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 16,
          "&:last-child": {
            paddingBottom: 16,
          },
        },
      },
    },

    // ── Dialog ───────────────────────────────────────────────────────────────────
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: shadowHigh,
          border: `1px solid ${C.divider}`,
        },
      },
    },

    // ── DialogTitle ──────────────────────────────────────────────────────────────
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: "1rem",
          fontWeight: 600,
          padding: "16px 20px 12px",
          borderBottom: `1px solid ${C.divider}`,
        },
      },
    },

    // ── DialogContent ────────────────────────────────────────────────────────────
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: "20px",
        },
      },
    },

    // ── DialogActions ────────────────────────────────────────────────────────────
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: "12px 20px 16px",
          borderTop: `1px solid ${C.divider}`,
          gap: 8,
        },
      },
    },

    // ── Drawer ───────────────────────────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: `1px solid ${C.divider}`,
          boxShadow: shadowHigh,
        },
      },
    },

    // ── TableCell ────────────────────────────────────────────────────────────────
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: C.divider,
          fontSize: "0.875rem",
          padding: "8px 12px",
          color: C.textPrimary,
        },
        head: {
          fontSize: "0.6875rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: C.textSecondary,
          backgroundColor: alpha(C.muted, 0.4),
          padding: "7px 12px",
        },
        sizeSmall: {
          padding: "6px 12px",
        },
      },
    },

    // ── TableRow ─────────────────────────────────────────────────────────────────
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&.MuiTableRow-hover:hover": {
            backgroundColor: alpha(C.primary, 0.04),
          },
          "&:last-child td, &:last-child th": {
            borderBottom: 0,
          },
        },
      },
    },

    // ── Chip ─────────────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600,
          letterSpacing: "0.01em",
        },
        sizeSmall: {
          height: 20,
          fontSize: "0.6875rem",
        },
        sizeMedium: {
          height: 26,
          fontSize: "0.8125rem",
        },
        label: {
          paddingLeft: 7,
          paddingRight: 7,
        },
        labelSmall: {
          paddingLeft: 6,
          paddingRight: 6,
        },
      },
    },

    // ── Tabs ─────────────────────────────────────────────────────────────────────
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 40,
          borderBottom: `1px solid ${C.divider}`,
        },
        indicator: {
          height: 2,
          borderRadius: "2px 2px 0 0",
        },
      },
    },

    // ── Tab ──────────────────────────────────────────────────────────────────────
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 40,
          textTransform: "none",
          fontWeight: 500,
          fontSize: "0.875rem",
          letterSpacing: 0,
          padding: "8px 16px",
          "&.Mui-selected": {
            fontWeight: 600,
          },
        },
      },
    },

    // ── Tooltip ──────────────────────────────────────────────────────────────────
    MuiTooltip: {
      defaultProps: {
        arrow: true,
      },
      styleOverrides: {
        tooltip: {
          backgroundColor: C.textPrimary,
          color: "#FFFFFF",
          fontSize: "0.75rem",
          fontWeight: 500,
          borderRadius: 6,
          padding: "5px 10px",
          boxShadow: shadowBase,
        },
        arrow: {
          color: C.textPrimary,
        },
      },
    },

    // ── Divider ──────────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: C.divider,
        },
      },
    },

    // ── ListItemButton ───────────────────────────────────────────────────────────
    // Drives sidebar nav item selected state — removes need for per-item sx overrides
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "&.Mui-selected": {
            backgroundColor: alpha(C.primary, 0.12),
            "&:hover": {
              backgroundColor: alpha(C.primary, 0.18),
            },
          },
          "&:hover": {
            backgroundColor: alpha(C.textPrimary, 0.05),
          },
        },
      },
    },

    // ── AppBar ───────────────────────────────────────────────────────────────────
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundColor: C.paper,
          borderBottom: `1px solid ${C.divider}`,
          color: C.textPrimary,
        },
      },
    },

    // ── FormHelperText ───────────────────────────────────────────────────────────
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          fontSize: "0.75rem",
          marginTop: 3,
          marginLeft: 0,
        },
      },
    },

    // ── Alert ────────────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: "0.875rem",
        },
      },
    },

    // ── Skeleton ─────────────────────────────────────────────────────────────────
    MuiSkeleton: {
      defaultProps: {
        animation: "wave",
      },
      styleOverrides: {
        root: {
          borderRadius: 6,
          backgroundColor: alpha(C.textPrimary, 0.08),
        },
      },
    },
  },
});
