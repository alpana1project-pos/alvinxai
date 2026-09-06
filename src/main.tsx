import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./chat-history.css";

// Alvin chat UI: new chat, history, delete, and provider diagnostics.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);