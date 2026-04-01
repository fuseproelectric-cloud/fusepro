import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AtlantisContext, atlantisContextDefaultValues } from "@jobber/components/AtlantisContext";
import "@jobber/design/dist/foundation.css";
import "@jobber/components/styles";
import "./index.css";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <AtlantisContext.Provider value={{ ...atlantisContextDefaultValues, locale: "en", currencySymbol: "$" }}>
      <App />
    </AtlantisContext.Provider>
  </StrictMode>
);
