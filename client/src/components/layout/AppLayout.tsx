import { useState } from "react";
import Box from "@mui/material/Box";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { SIDEBAR_W } from "@/lib/layout";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <Box
        sx={{ pl: { xs: 0, lg: `${SIDEBAR_W}px` } }}
        className="flex flex-col min-h-screen"
      >
        <Header onMobileMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 w-full">{children}</main>
      </Box>
    </div>
  );
}
