import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import { useEffect, useState } from "react";
import io from "socket.io-client";

import { SocketProvider } from "./context";

export function Layout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [loginId, setLoginId] = useState("");

  useEffect(() => {
    const newSocket = io("/user");
    setSocket(newSocket);

    newSocket.on("login success", (userData) => {
      setUser(userData);
    });

    newSocket.on("login failed", (error) => {
      console.error("Login failed:", error);
      alert("Login failed: " + error);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    socket.emit("login", loginId);
  };

  if (!socket) {
    return <div>Connecting to server...</div>;
  }

  if (!user) {
    return (
      <form onSubmit={handleLogin}>
        <input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="Enter User ID" required />
        <button type="submit">Login</button>
      </form>
    );
  }

  return (
    <SocketProvider socket={socket} user={user}>
      <div>
        <p>
          Logged in as: {user.user_id} ({user.user_role})
        </p>

        <button onClick={() => setUser(null)}>Logout</button>
        <Outlet />
      </div>
    </SocketProvider>
  );
}
