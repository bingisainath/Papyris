import { useAuth } from "../app/AuthProvider";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🏠 Home</h1>
      <p style={styles.subtitle}>
        You are logged in successfully.
      </p>

      <div style={styles.actions}>
        <button onClick={() => navigate("/login")} style={styles.button}>
          Go to Login
        </button>

        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          style={{ ...styles.button, backgroundColor: "#e74c3c" }}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

const styles: any = {
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    background: "#f5f7fa",
  },
  title: {
    fontSize: "32px",
    marginBottom: "10px",
  },
  subtitle: {
    fontSize: "16px",
    marginBottom: "30px",
    color: "#555",
  },
  actions: {
    display: "flex",
    gap: "16px",
  },
  button: {
    padding: "10px 20px",
    fontSize: "14px",
    cursor: "pointer",
    border: "none",
    borderRadius: "6px",
    backgroundColor: "#3498db",
    color: "#fff",
  },
};

export default Home;
