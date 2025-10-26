import { useSocket } from "@/context/SocketProvider";
import { peer } from "@/services/peer.services";
import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export const Room = () => {
    const [myStream, setMyStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [remoteSocketId, setRemoteSocketId] = useState<string | null>();

    const socket = useSocket();

    const myVidioRef = useRef<HTMLVideoElement>(null);
    const remoteVidioRef = useRef<HTMLVideoElement>(null);

    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);


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

    // Control handlers
    const toggleMic = () => {
        if (myStream) {
            const audioTrack = myStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicOn(audioTrack.enabled);
            }
        }
    };

    const toggleCamera = () => {
        if (myStream) {
            const videoTrack = myStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraOn(videoTrack.enabled);
            }
        }
    };

    const toggleScreenShare = useCallback(async () => {
        if (!peer?.peer) return;

        try {
            if (!isScreenSharing) {
                // Start screen share
                const displayStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false,
                });

                const screenTrack = displayStream.getVideoTracks()[0];
                const sender = peer.peer.getSenders().find((s) => s.track?.kind === "video");

                if (sender) {
                    sender.replaceTrack(screenTrack);
                }

                if (myVidioRef.current) {
                    myVidioRef.current.srcObject = displayStream;
                }

                setIsScreenSharing(true);

                // When user manually stops screen share from browser UI
                screenTrack.onended = async () => {
                    try {
                        const cameraStream = await navigator.mediaDevices.getUserMedia({
                            video: true,
                            audio: true,
                        });
                        const camTrack = cameraStream.getVideoTracks()[0];
                        if (sender) sender.replaceTrack(camTrack);
                        if (myVidioRef.current) myVidioRef.current.srcObject = cameraStream;
                        setMyStream(cameraStream);
                        setIsScreenSharing(false);
                    } catch (error) {
                        console.error("Error reverting to camera:", error);
                    }
                };
            } else {
                // Stop screen sharing and revert to camera manually
                const cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                const camTrack = cameraStream.getVideoTracks()[0];
                const sender = peer.peer.getSenders().find((s) => s.track?.kind === "video");

                if (sender) sender.replaceTrack(camTrack);
                if (myVidioRef.current) myVidioRef.current.srcObject = cameraStream;
                setMyStream(cameraStream);
                setIsScreenSharing(false);
            }
        } catch (error) {
            console.error("Error toggling screen share:", error);
            setIsScreenSharing(false);
        }
    }, [isScreenSharing, peer, myVidioRef, setMyStream]);

    const endCall = useCallback(() => {
        console.log("Ending call...");

        // Stop all local media tracks
        if (myStream) {
            myStream.getTracks().forEach(track => track.stop());
            setMyStream(null);
        }

        // Stop all remote tracks (optional cleanup)
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
            setRemoteStream(null);
        }

        // Close peer connection
        if (peer.peer) {
            peer.peer.close();
        }

        // Notify the other peer
        if (socket && remoteSocketId) {
            socket.emit("call:ended", { to: remoteSocketId });
        }

        // Reset UI flags
        setIsMicOn(true);
        setIsCameraOn(true);
        setIsScreenSharing(false);
        setRemoteSocketId(null);

        // Clear video refs
        if (myVidioRef.current) {
            myVidioRef.current.srcObject = null;
        }
        if (remoteVidioRef.current) {
            remoteVidioRef.current.srcObject = null;
        }

        console.log("Call ended and cleaned up.");
    }, [myStream, remoteStream, socket, remoteSocketId]);


    return (
        <div className="h-screen w-full bg-neutral-950 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-neutral-900/80 backdrop-blur-sm border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-neutral-400" />
                        <h1 className="text-lg font-semibold text-white">Video Call Room</h1>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                        <div className={`w-2 h-2 rounded-full ${remoteSocketId ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                        <span className="text-sm text-neutral-400">
                            {remoteSocketId ? 'Connected' : 'Waiting for peer...'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {myStream && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-medium text-emerald-400">Live</span>
                        </div>
                    )}
                </div>
            </header>

            {/* Video Grid */}
            <main className="flex-1 p-4 md:p-6 overflow-hidden">
                <div className="h-full w-full grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                    {/* Remote Video (Primary) */}
                    <Card className="relative bg-neutral-900 border-neutral-800 rounded-2xl overflow-hidden shadow-2xl group transition-all duration-300 hover:border-neutral-700 hover:shadow-emerald-500/10">
                        <div className="absolute inset-0 bg-linear-to-br from-neutral-800/50 to-neutral-900/50" />
                        <video
                            ref={remoteVidioRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                        {!remoteStream && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className="w-20 h-20 rounded-full bg-neutral-800 border-2 border-neutral-700 flex items-center justify-center mb-4">
                                    <Users className="w-10 h-10 text-neutral-600" />
                                </div>
                                <p className="text-neutral-500 text-sm font-medium">Waiting for remote stream...</p>
                            </div>
                        )}
                        <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10">
                            <span className="text-xs font-medium text-white">Remote</span>
                        </div>
                        {remoteStream && (
                            <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg border border-emerald-500/30">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-medium text-emerald-400">Active</span>
                            </div>
                        )}
                    </Card>

                    {/* My Video */}
                    <Card className="relative bg-neutral-900 border-neutral-800 rounded-2xl overflow-hidden shadow-2xl group transition-all duration-300 hover:border-neutral-700">
                        <div className="absolute inset-0 bg-linear-to-br from-neutral-800/50 to-neutral-900/50" />
                        <video
                            ref={myVidioRef}
                            muted
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover scale-x-[-1]"
                        />
                        {!myStream && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className="w-20 h-20 rounded-full bg-neutral-800 border-2 border-neutral-700 flex items-center justify-center mb-4">
                                    <Video className="w-10 h-10 text-neutral-600" />
                                </div>
                                <p className="text-neutral-500 text-sm font-medium">Camera initializing...</p>
                            </div>
                        )}
                        <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10">
                            <span className="text-xs font-medium text-white">You</span>
                        </div>
                        {!isCameraOn && myStream && (
                            <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center">
                                <div className="text-center">
                                    <VideoOff className="w-12 h-12 text-neutral-600 mx-auto mb-2" />
                                    <p className="text-neutral-500 text-sm">Camera is off</p>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </main>

            {/* Control Bar */}
            <footer className="bg-neutral-900/80 backdrop-blur-sm border-t border-neutral-800 px-6 py-4">
                <div className="max-w-2xl mx-auto">
                    <TooltipProvider>
                        <div className="flex items-center justify-center gap-3">
                            {/* Microphone */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        onClick={toggleMic}
                                        size="lg"
                                        variant={isMicOn ? "secondary" : "destructive"}
                                        className={`rounded-full w-14 h-14 transition-all duration-200 ${isMicOn
                                            ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                                            : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                                            }`}
                                    >
                                        {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{isMicOn ? 'Mute' : 'Unmute'}</p>
                                </TooltipContent>
                            </Tooltip>

                            {/* Camera */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        onClick={toggleCamera}
                                        size="lg"
                                        variant={isCameraOn ? "secondary" : "destructive"}
                                        className={`rounded-full w-14 h-14 transition-all duration-200 ${isCameraOn
                                            ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                                            : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                                            }`}
                                    >
                                        {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{isCameraOn ? 'Turn off camera' : 'Turn on camera'}</p>
                                </TooltipContent>
                            </Tooltip>

                            {/* Screen Share */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        onClick={toggleScreenShare}
                                        size="lg"
                                        variant="secondary"
                                        className={`rounded-full w-14 h-14 transition-all duration-200 ${isScreenSharing
                                            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                                            }`}
                                    >
                                        <Monitor className="w-5 h-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{isScreenSharing ? 'Stop sharing' : 'Share screen'}</p>
                                </TooltipContent>
                            </Tooltip>

                            {/* End Call */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        onClick={endCall}
                                        size="lg"
                                        variant="destructive"
                                        className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700 text-white transition-all duration-200 shadow-lg shadow-red-500/20 hover:shadow-red-500/40"
                                    >
                                        <PhoneOff className="w-5 h-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>End call</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </TooltipProvider>
                </div>
            </footer>
        </div>
    )
}