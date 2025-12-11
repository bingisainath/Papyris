let socket: WebSocket | null = null;
let isConnecting = false;
let isOpen = false;

// Stores messages that tried to send before WS was ready
let sendQueue: any[] = [];

// A promise to wait until connection is fully open
let waitForOpen: Promise<void> | null = null;
let resolveOpen: (() => void) | null = null;

export function connectWS(token: string, onMessage: (msg: any) => void) {
  if (socket && isOpen) {
    console.log("[WS] Already connected");
    return;
  }

  if (isConnecting) {
    console.log("[WS] Already connecting...");
    return;
  }

  console.log("[WS] Connecting...");
  isConnecting = true;

  socket = new WebSocket("ws://localhost:9000");

  // Create promise and resolver
  waitForOpen = new Promise((resolve) => (resolveOpen = resolve));

  socket.onopen = () => {
    console.log("[WS] Connected");
    isConnecting = false;
    isOpen = true;

    // Resolve the open promise
    resolveOpen?.();

    // Send authentication token safely
    socket!.send(token);

    // Flush any queued messages
    sendQueue.forEach((msg) => socket!.send(JSON.stringify(msg)));
    sendQueue = [];
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      onMessage(msg);
    } catch {
      console.log("[WS RAW]", event.data);
    }
  };

  socket.onclose = () => {
    console.warn("[WS] Closed");
    isOpen = false;
    isConnecting = false;
  };

  socket.onerror = (err) => {
    console.error("[WS Error]", err);
  };
}

// Safe send function
export async function safeSend(data: any) {
  if (!socket) {
    console.warn("[WS] No socket, message queued");
    sendQueue.push(data);
    return;
  }

  if (!isOpen) {
    console.log("[WS] Waiting for open...");
    await waitForOpen;
  }

  socket.send(JSON.stringify(data));
}
