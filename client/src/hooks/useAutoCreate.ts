import { useEffect } from "react";
import { useSearch, useLocation } from "wouter";

/** Calls `openCreate` once if URL contains ?new=1, then cleans the param */
export function useAutoCreate(openCreate: () => void) {
  const search = useSearch();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (new URLSearchParams(search).get("new") === "1") {
      openCreate();
      // Remove the param without adding to history
      navigate(window.location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
}
