import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

let waitingUser = null;

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // JOIN QUEUE
  socket.on("join", () => {
    if (waitingUser) {
      socket.partner = waitingUser;
      waitingUser.partner = socket;

      socket.emit("matched", { initiator: true });
      waitingUser.emit("matched", { initiator: false });

      waitingUser = null;
    } else {
      waitingUser = socket;
    }
  });

  // NEXT USER
  socket.on("next", () => {
    if (socket.partner) {
      socket.partner.emit("partner-disconnected");
      socket.partner.partner = null;
    }

    socket.partner = null;

    socket.emit("join");
  });

  // SIGNALING
  socket.on("signal", (data) => {
    socket.partner?.emit("signal", data);
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    if (socket.partner) {
      socket.partner.emit("partner-disconnected");
      socket.partner.partner = null;
    }

    if (waitingUser === socket) {
      waitingUser = null;
    }

    console.log("User disconnected:", socket.id);
  });
});

server.listen(5001, () => {
  console.log("Server running on port 5001");
});