import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { DialogProvider } from "./contexts/DialogContext";
import { ToastProvider } from "./contexts/ToastContext";
import { Analytics } from "@vercel/analytics/react";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <React.StrictMode>
    <Analytics />
    <AuthProvider>
      <ToastProvider>
        <DialogProvider>
          <App />
        </DialogProvider>
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>,
);
