import { Route, Routes } from "react-router-dom"
import { JoinRoom } from "./components/room/JoinRoom"
import { Room } from "./components/room/Room"

function App() {
  return (
    <Routes>
      <Route path="/" Component={JoinRoom} />
      <Route path="/room/:roomCode" Component={Room} />
    </Routes>
  )
}

export default App
