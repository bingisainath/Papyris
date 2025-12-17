import { createBrowserRouter } from "react-router-dom";
import Login from "../pages/Authentication";
// import Signup from "../pages/auth/Signup";
import Home from "../pages/Home";
import { RequireAuth } from "../app/RequireAuth";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Login /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <Home />
      </RequireAuth>
    ),
  },
]);
