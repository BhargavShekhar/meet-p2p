import { Server } from "socket.io";

const io = new Server(8080, {
    cors: {
        origin: true,
        methods: ["GET", "POST"]
    }
})

io.on("connection", (socket) => {
    console.log("connected with", socket.id);

    socket.on("room:join", ({ email, roomCode }) => {
        io.to(roomCode).emit("user:joined", { email, id: socket.id });
        socket.join(roomCode);

        io.to(socket.id).emit("room:join", { email, roomCode });
    })

    socket.on("user:call", ({ to, offer }) => {
        io.to(to).emit("incomming:call", { from: socket.id, offer });
    })

    socket.on("call:accepted", ({ to, ans }) => {
        io.to(to).emit("call:accepted", { from: socket.id, ans });
    })

    socket.on("peer:ice:candidate", ({ to, candidate }) => {
        io.to(to).emit("peer:ice:candidate", { from: socket.id, candidate });
    })

    socket.on("disconnect", () => {
        console.log("disconnected with", socket.id);
    })
})