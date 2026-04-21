import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5001");

function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  const [status, setStatus] = useState("Idle");

  const createPeer = (initiator) => {
    if (!streamRef.current) return;

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    streamRef.current.getTracks().forEach(track => {
      peer.addTrack(track, streamRef.current);
    });

    peer.ontrack = (event) => {
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { candidate: event.candidate });
      }
    };

    peerRef.current = peer;

    if (initiator) {
      peer.createOffer()
        .then(offer => peer.setLocalDescription(offer))
        .then(() => {
          socket.emit("signal", { sdp: peer.localDescription });
        });
    }
  };

  const handleSignal = async (data) => {
    let peer = peerRef.current;

    if (!peer) {
      createPeer(false);
      peer = peerRef.current;
    }

    if (data.sdp) {
      await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));

      if (data.sdp.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("signal", { sdp: peer.localDescription });
      }
    }

    if (data.candidate) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error("ICE error:", err);
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      streamRef.current = stream;

      if (localVideo.current) {
        localVideo.current.srcObject = stream;
      }

      socket.on("matched", ({ initiator }) => {
        setStatus("Connected");
        createPeer(initiator);
      });

      socket.on("signal", handleSignal);

      socket.on("partner-disconnected", () => {
        setStatus("Waiting...");
        peerRef.current?.close();
        peerRef.current = null;

        if (remoteVideo.current) {
          remoteVideo.current.srcObject = null;
        }
      });
    };

    init();

    return () => {
      socket.off("matched");
      socket.off("signal");
      socket.off("partner-disconnected");
    };
  }, []);

  return (
  <div className="container">
    <h2 className="status">{status}</h2>

    <div className="video-container">
      <div className="video-card">
        <video ref={localVideo} autoPlay muted playsInline />
        <span className="label">You</span>
      </div>

      <div className="video-card">
        <video ref={remoteVideo} autoPlay playsInline />
        <span className="label">Stranger</span>
      </div>
    </div>

    <div className="controls">
      <button onClick={() => {
        setStatus("Searching...");
        socket.emit("join");
      }}>
        Start
      </button>

      <button onClick={() => {
        setStatus("Skipping...");
        socket.emit("next");
      }}>
        Next
      </button>
    </div>
  </div>
);
}

export default App;