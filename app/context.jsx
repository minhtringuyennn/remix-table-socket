import { createContext, useContext } from "react";

const SocketContext = createContext();
const UserContext = createContext();

export function useSocket() {
  return useContext(SocketContext);
}

export function useUser() {
  return useContext(UserContext);
}

export function SocketProvider({ socket, user, children }) {
  return (
    <SocketContext.Provider value={socket}>
      <UserContext.Provider value={user}>{children}</UserContext.Provider>
    </SocketContext.Provider>
  );
}
