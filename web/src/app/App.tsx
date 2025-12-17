import { RouterProvider } from "react-router-dom";
import { router } from "../routes/router";
import { AuthProvider } from "./AuthProvider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const App = () => {
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
