class PeerServices {
    public peer: RTCPeerConnection;

    constructor() {
        this.peer = new RTCPeerConnection({
            iceServers: [{
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:global.stun.twilio.com:3478"
                ]
            }]
        })
    }

    async getOffer() {
        const offer = await this.peer.createOffer();
        this.peer.setLocalDescription(new RTCSessionDescription(offer));
        return offer;
    }

    async getAnswer(offer: RTCSessionDescriptionInit) {
        await this.peer.setRemoteDescription(offer);
        const ans = await this.peer.createAnswer();
        this.peer.setLocalDescription(new RTCSessionDescription(ans));
        return ans;
    }

    async setRemoteDescription(ans: RTCSessionDescriptionInit) {
        await this.peer.setRemoteDescription(new RTCSessionDescription(ans));
    }

    async addIceCandidate(candidate: RTCIceCandidateInit) {
        await this.peer.addIceCandidate(candidate);
    }
}

export const peer = new PeerServices();