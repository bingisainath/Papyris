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


// src/App.tsx

// import { useEffect } from 'react';
// import { RouterProvider } from "react-router-dom";
// import { useDispatch, useSelector } from 'react-redux';
// import { router } from "../routes/router";
// import { AuthProvider } from "../app/AuthProvider";
// import { ToastContainer } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";

// import { loadUser } from '../redux/actions/authActions';  // ✅ ADD THIS
// import { selectToken, selectUser } from '../redux/slices/authSlice';  // ✅ ADD THIS
// import { useWebSocket } from '../hooks/useWebSocket';
// import type { AppDispatch } from '../redux/store';

// const App = () => {
//   const dispatch = useDispatch<AppDispatch>();
//   const token = useSelector(selectToken);
//   const user = useSelector(selectUser);

//   // ✅ ADD THIS: Load user from token on app startup
//   useEffect(() => {
//     console.log('🔍 App startup check:');
//     console.log('  Token:', token ? 'exists' : 'null');
//     console.log('  User:', user ? 'exists' : 'null');

//     // If we have token but no user, load user from backend
//     if (token && !user) {
//       console.log('📥 Loading user data from backend...');
//       dispatch(loadUser());
//     }
//   }, [dispatch, token, user]);

//   // Connect WebSocket when authenticated
//   useWebSocket(token || undefined);

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

// src/App.tsx - SIMPLIFIED (Uses AuthProvider, not Redux auth)

import { RouterProvider } from "react-router-dom";
import { router } from "../routes/router";
import { AuthProvider } from "../app/AuthProvider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useWebSocket } from '../hooks/useWebSocket';
import { tokenStore } from '../utils/token';

const App = () => {
  // ✅ Get token from tokenStore (not Redux)
  const token = tokenStore.get();
  
  // Connect WebSocket when we have a token
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