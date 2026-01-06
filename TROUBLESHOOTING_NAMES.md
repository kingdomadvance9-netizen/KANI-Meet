# Troubleshooting: User Names and Avatars Not Showing

## Problem

- Only seeing your own name, not other users' names
- Seeing "User xxxx" instead of real names from Clerk
- Avatars/profile images not displaying
- Participant list shows generated names

## Root Cause

The **server is not storing or sending back the userName and userImageUrl** that the frontend provides.

---

## Quick Fix (Server Side)

### 1. Verify Server Receives User Info

In your server's `join-mediasoup-room` handler, add this log:

```javascript
socket.on(
  "join-mediasoup-room",
  async (
    { roomId, rtpCapabilities, userName, userImageUrl, isCreator },
    callback
  ) => {
    console.log(
      `🔍 JOIN - User: ${userName}, Image: ${userImageUrl}, Creator: ${isCreator}`
    );
    // ...rest of your code
  }
);
```

**Expected output:**

```
🔍 JOIN - User: John Doe, Image: https://img.clerk.com/..., Creator: true
```

**If you see `undefined`:** The parameter names don't match. Frontend sends `userName`, server might expect `name`.

---

### 2. Store User Info in Peer Object

When creating the peer, capture ALL the user data:

```javascript
currentPeer = {
  id: socket.id,
  name: userName || "User " + socket.id.slice(0, 4), // ✅ Store this
  imageUrl: userImageUrl || null, // ✅ Store this
  isHost: isCreator || false, // ✅ Store this
  rtpCapabilities: rtpCapabilities,
  sendTransport: null,
  recvTransport: null,
  producers: new Map(),
  consumers: new Map(),
};

room.peers.set(socket.id, currentPeer);
```

---

### 3. Include User Info in Participant List

When emitting `participant-list-update`, include ALL fields:

```javascript
const participants = Array.from(room.peers.values()).map((p) => ({
  id: p.id,
  name: p.name, // ✅ Must include
  imageUrl: p.imageUrl, // ✅ Must include
  isAudioMuted: false,
  isVideoPaused: false,
  isHost: p.isHost || false, // ✅ Must include
}));

console.log(`📤 SENDING:`, participants); // Debug log
io.to(roomId).emit("participant-list-update", participants);
```

**Expected console output:**

```
📤 SENDING: [
  { id: "abc", name: "John Doe", imageUrl: "https://...", isHost: true },
  { id: "def", name: "Jane Smith", imageUrl: "https://...", isHost: false }
]
```

---

## Debugging on Frontend

### Check Browser Console

When you join a meeting, you should see:

```
🚀 Joining Mediasoup Room: room-123 as John Doe
📤 Sending join request with: {
  roomId: "room-123",
  userName: "John Doe",
  userImageUrl: "provided",
  isCreator: true
}
👥 Participants updated: [...]
📝 Participant details:
  - ID: abc123, Name: John Doe, Image: https://..., Host: true
  - ID: def456, Name: Jane Smith, Image: https://..., Host: false
```

### If You See "User undefined" or "User null"

Problem is on **server side** - it's not capturing the userName parameter.

### If You See Names But No Images

Check the participant object details:

- If `Image: none` → Server is not storing `imageUrl`
- If `Image: undefined` → Server is not including it in participant list
- If `Image: https://...` → Problem is in the UI rendering

---

## Common Server Mistakes

### ❌ Mistake 1: Wrong Parameter Names

```javascript
// Frontend sends: userName, userImageUrl
// Server expects: name, image
socket.on("join-mediasoup-room", async ({ roomId, name, image }, callback) => {
  // This won't work! ❌
```

### ❌ Mistake 2: Not Storing in Peer

```javascript
currentPeer = {
  id: socket.id,
  // Missing: name, imageUrl, isHost
  rtpCapabilities: rtpCapabilities,
  // ...
};
```

### ❌ Mistake 3: Not Including in Participant List

```javascript
const participants = Array.from(room.peers.values()).map((p) => ({
  id: p.id,
  // Missing: name, imageUrl, isHost
}));
```

### ❌ Mistake 4: Using socket.to() Instead of io.to()

```javascript
// ❌ This excludes the sender - you won't see yourself!
socket.to(roomId).emit("participant-list-update", participants);

// ✅ This includes everyone
io.to(roomId).emit("participant-list-update", participants);
```

---

## Verification Steps

1. **Open meeting in 2 browsers**
2. **Check console in both browsers** for the debug logs
3. **Check server console** for:
   - JOIN requests with real names
   - Participant lists being sent with real names
4. **Verify participant sidebar** shows:
   - Real names from Clerk
   - Profile images or initials
   - Host badge (👑) for creator
5. **Verify video tiles** show:
   - Names on bottom bar
   - Host badge if applicable

---

## Still Not Working?

1. Share your server's `join-mediasoup-room` handler code
2. Share the console logs from browser (both users)
3. Share the server console logs when joining
4. Check [SERVER_FIXES_SHORT.md](./SERVER_FIXES_SHORT.md) for complete implementation

The issue is almost always that the server is not capturing or returning the user info fields properly.
