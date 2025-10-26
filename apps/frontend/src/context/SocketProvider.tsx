import { SIGNALLING_SERVER_URI } from "@/lib/config";
import { createContext, useContext, useMemo } from "react";
import { io, type Socket } from "socket.io-client";

const SocketContext = createContext<Socket | null>(null);

export const useSocket = () => {
    const socket = useContext(SocketContext);
    return socket;
}

type Props = {
    children: React.ReactNode
}

export const SocketProvider = ({ children }: Props) => {
    const socket = useMemo(() => io(SIGNALLING_SERVER_URI), []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    )
}