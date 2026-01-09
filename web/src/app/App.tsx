// import { RouterProvider } from "react-router-dom";
// import { router } from "../routes/router";
// import { AuthProvider } from "./AuthProvider";
// import { ToastContainer } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";

// import { useWebSocket } from '../hooks/useWebSocket';

// const App = () => {

//   useWebSocket();

//   return (
//     <AuthProvider>
//       <RouterProvider router={router} />

//       <ToastContainer
//         position="top-center"
//         autoClose={2500}
//         hideProgressBar={false}
//         newestOnTop
//         closeOnClick
//         pauseOnHover
//         draggable
//       />
//     </AuthProvider>
//   );
// };

// export default App;

// src/App.tsx - COMPLETE WITH AUTH & WEBSOCKET

import { useEffect } from 'react';
import { RouterProvider } from "react-router-dom";
import { useDispatch, useSelector } from 'react-redux';
import { router } from "../routes/router";
import { AuthProvider } from "../app/AuthProvider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { loadUser } from '../redux/actions/authActions';
import { selectToken, selectIsAuthenticated } from '../redux/slices/authSlice';
import { useWebSocket } from '../hooks/useWebSocket';
import type { AppDispatch } from '../redux/store';

const App = () => {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector(selectToken);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // Load user on app startup if token exists
  useEffect(() => {
    if (token && !isAuthenticated) {
      dispatch(loadUser());
    }
  }, [dispatch, token, isAuthenticated]);

  // Connect WebSocket when authenticated
  useWebSocket(token || undefined);

  return (
    <AuthProvider>
      <RouterProvider router={router} />

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