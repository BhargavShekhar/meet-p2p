import { useSocket } from "@/context/SocketProvider";
import { peer } from "@/services/peer.services";
import { useCallback, useEffect, useRef, useState } from "react"

export const Room = () => {
    const [myStream, setMyStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [remoteSocketId, setRemoteSocketId] = useState<string | null>();

    const socket = useSocket();

    const myVidioRef = useRef<HTMLVideoElement>(null);
    const remoteVidioRef = useRef<HTMLVideoElement>(null);

    const sendStream = useCallback((stream: MediaStream) => {
        for (const track of stream.getTracks()) {
            peer.peer.addTrack(track, stream);
        }
    }, [myStream])

    const handleUserJoined = useCallback(async ({ id }: {
        email: string,
        id: string
    }) => {
        setRemoteSocketId(id);

        console.log(`user ${id} joined calling to ${id}`);

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });

        setMyStream(stream);

        sendStream(stream);

        const offer = await peer.getOffer();

        socket?.emit("user:call", { to: id, offer });
    }, [socket, sendStream]);

    const handleIncommingCall = useCallback(async ({ from, offer }: {
        from: string,
        offer: RTCSessionDescriptionInit
    }) => {
        console.log(`Incomming call from ${from} call accepted...`);

        setRemoteSocketId(from);

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        })

        setMyStream(stream);

        sendStream(stream);

        const ans = await peer.getAnswer(offer);

        socket?.emit("call:accepted", { to: from, ans });
    }, [socket, sendStream]);

    const handleCallAccepted = useCallback(async ({ from, ans }: {
        from: string
        ans: RTCSessionDescriptionInit
    }) => {
        console.log(`Accepting call from ${from} -> ans ${ans}`);
        await peer.setRemoteDescription(ans);
    }, []);

    const handleIceCandidate = useCallback(async ({ candidate }: {
        from: string,
        candidate: RTCIceCandidateInit
    }) => {
        await peer.addIceCandidate(candidate);
    }, []);

    useEffect(() => {
        if (!socket) {
            throw new Error("Could not connect to socket");
        }

        socket.on("user:joined", handleUserJoined);
        socket.on("incomming:call", handleIncommingCall);
        socket.on("call:accepted", handleCallAccepted);
        socket.on("peer:ice:candidate", handleIceCandidate);

        peer.peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("peer:ice:candidate", {
                    to: remoteSocketId,
                    candidate: event.candidate
                })
            }
        }

        peer.peer.ontrack = (event) => {
            const [remoteStream] = event.streams;
            console.log("Got remote track!!");
            setRemoteStream(remoteStream);
        }

        return () => {
            socket.off("user:joined", handleUserJoined);
            socket.off("incomming:call", handleIncommingCall);
            socket.off("call:accepted", handleCallAccepted);
            socket.off("peer:ice:candidate", handleIceCandidate);
        }
    }, [
        socket,
        handleUserJoined,
        handleIncommingCall,
        handleCallAccepted,
        handleIceCandidate,
        remoteSocketId
    ]);

    useEffect(() => {
        if (myVidioRef.current && myStream) {
            myVidioRef.current.srcObject = myStream;
        }
    }, [myStream]);

    useEffect(() => {
        if (remoteVidioRef.current && remoteStream) {
            remoteVidioRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    return (
        <div className="h-screen w-full bg-neutral-200 flex justify-center items-center px-6">
            <div className="bg-yellow-300 h-1/2 w-1/2 flex flex-col justify-center items-center gap-4">
                <h1>Your Stream</h1>
                <video
                    ref={myVidioRef}
                    muted
                    autoPlay
                    playsInline
                    height="400px"
                    width="400px"
                />
            </div>
            <div className="bg-cyan-300 h-1/2 w-1/2 flex flex-col justify-center items-center gap-4">
                <h1>Remote Stream</h1>
                <video
                    ref={remoteVidioRef}
                    autoPlay
                    playsInline
                    height="400px"
                    width="400px"
                />
            </div>
        </div>
    )
}