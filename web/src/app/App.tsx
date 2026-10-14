// src/App.tsx - SIMPLIFIED (Uses AuthProvider, not Redux auth)

import { RouterProvider } from "react-router-dom";
import { router } from "../routes/router";
import { AuthProvider } from "../app/AuthProvider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ConfirmHost } from "../components/organisms/ConfirmDialog";

// import { useWebSocket } from '../hooks/useWebSocket';
// import { tokenStore } from '../utils/token';

const App = () => {
  // ✅ Get token from tokenStore (not Redux)
  // const token = tokenStore.get();

  // // Connect WebSocket when we have a token
  // useWebSocket(token || undefined);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <ConfirmHost />

      <ToastContainer
        position="top-center"
        autoClose={2500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
      />
    </AuthProvider>
  );
};

export default App;