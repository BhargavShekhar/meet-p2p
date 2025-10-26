import { useSocket } from "@/context/SocketProvider"
import { Button } from "../ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { useCallback, useEffect, useState } from "react"
import { Loader2 } from 'lucide-react';
import { useNavigate } from "react-router-dom"


export const JoinRoom = () => {
    const [email, setEmail] = useState('');
    const [roomCode, setRoomCode] = useState('');

    const [errors, setErrors] = useState({ email: '', roomCode: '' });

    const [isLoading, setIsLoading] = useState(false);

    const socket = useSocket();

    const nav = useNavigate();

    const validateForm = () => {
        const newErrors = { email: '', roomCode: '' };
        let isValid = true;

        if (!email.trim()) {
            newErrors.email = 'email is required.';
            isValid = false;
        } else if (email.length < 3) {
            newErrors.email = 'email must be at least 3 characters.';
            isValid = false;
        }

        if (!roomCode.trim()) {
            newErrors.roomCode = 'Room code is required.';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (validateForm()) {
            setIsLoading(true);
            setErrors({ email: '', roomCode: '' });

            if (!socket) {
                setErrors({
                    ...errors,
                    roomCode: 'Failed to join room. Please try again.',
                });

                setIsLoading(false);

                return;
            }

            socket.emit("room:join", { email, roomCode });
            setIsLoading(false);
        }
    };

    const handleRoomJoin = useCallback(({ roomCode }: {
      email: string,
      roomCode: string
    }) => {
      nav(`/room/${roomCode}`);
    }, [])

    useEffect(() => {
      socket?.on("room:join", handleRoomJoin);

      return () => {
        socket?.off("room:join", handleRoomJoin);
      }
    }, [socket])

    return (
        <main className="flex items-center justify-center min-h-screen bg-linear-to-br from-indigo-50 via-white to-blue-50 font-sans p-4">

      <Card className="w-full max-w-md shadow-xl">

        {/* CardHeader for title and description */}
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Join a Room</CardTitle>
          <CardDescription className="text-base">
            Connect with your friends instantly
          </CardDescription>
        </CardHeader>

        {/* CardContent for the form */}
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* email Input Field */}
            <div className="space-y-2">
              <Label htmlFor="email">email</Label>
              <Input
                id="email"
                name="email"
                type="text"
                autoFocus // Autofocus on this field on page load
                autoComplete="email"
                placeholder="Enter your name"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby="email-error"
                className={errors.email ? 'ring-2 ring-destructive ring-offset-2' : ''}
              />
              {/* Error Message styled with text-destructive */}
              {errors.email && (
                <p id="email-error" className="text-sm font-medium text-destructive">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Room Code Input Field */}
            <div className="space-y-2">
              <Label htmlFor="roomCode">Room Code</Label>
              <Input
                id="roomCode"
                name="roomCode"
                type="text"
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                aria-invalid={!!errors.roomCode}
                aria-describedby="roomCode-error"
                className={errors.roomCode ? 'ring-2 ring-destructive ring-offset-2' : ''}
              />
              {/* Error Message */}
              {errors.roomCode && (
                <p id="roomCode-error" className="text-sm font-medium text-destructive">
                  {errors.roomCode}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Room'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
    )
}