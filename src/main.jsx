import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import { Brand } from "./components/Common";
import "./styles.css";
function App() {
  const { user, loading, error, restore } = useAuth();
  if (loading || error)
    return (
      <div className="boot">
        <Brand />
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="primary" onClick={restore}>
              Try again
            </button>
          </>
        ) : (
          <p role="status">Opening Thread…</p>
        )}
      </div>
    );
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />
      <Route
        path="/"
        element={user ? <ChatPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/chat/:id"
        element={user ? <ChatPage /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="boot">
        <Brand />
        <p>Thread couldn’t display this page.</p>
        <button className="primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
