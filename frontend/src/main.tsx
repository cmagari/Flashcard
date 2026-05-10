import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { DialogProvider } from "./components/Dialog";
import "katex/dist/katex.min.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <DialogProvider>
        <App />
      </DialogProvider>
    </HashRouter>
  </React.StrictMode>
);
