import React, { useEffect, useState } from "react";
import { login } from "./api/test"
// import { connectWS, sendTestMessage } from "./websocket/wsclient";
import { connectWS, safeSend } from "./websocket/wsclient";


function App() {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [wsMessages, setWsMessages] = useState<string[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    // 1️⃣ Login to backend (dummy login)
    login("user-1")
      .then((res) => {
        console.log("Logged in:", res);
        setToken(res.access_token);
        setUserId(res.user_id);

        // 2️⃣ Connect WebSocket using JWT
        connectWS(res.access_token, (msg) => {
          setWsMessages((prev) => [...prev, JSON.stringify(msg)]);
        });
      })
      .catch((err) => console.error("Login error:", err));
  }, []);

  // const handleSend = () => {
  //   sendTestMessage("user-2", text || "Hello from user-1!");
  //   setWsMessages((prev) => [...prev, `YOU → user-2: ${text}`]);
  //   setText("");
  // };

  const handleSend = () => {
  safeSend({
    type: "SEND_MESSAGE",
    receiver_id: "user-2",
    message: text || "Hello!",
  });

  setText("");
};



  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>Papyris Frontend</h1>

      <p><b>Logged in as:</b> {userId ?? "loading..."}</p>

      <h3>Messages</h3>
      <div
        style={{
          border: "1px solid #ccc",
          height: "200px",
          overflowY: "scroll",
          padding: "10px",
          marginBottom: "10px",
        }}
      >
        {wsMessages.map((m, i) => (
          <div key={i}>{m}</div>
        ))}
      </div>

      <input
        style={{ padding: "8px", width: "250px", marginRight: "8px" }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="type a message for user-2..."
      />

      <button onClick={handleSend} style={{ padding: "8px 12px" }}>
        Send
      </button>
    </div>
  );
}

export default App;
