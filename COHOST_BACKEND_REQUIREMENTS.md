# Co-Host Backend Implementation Requirements

## Overview

Frontend has been updated to support co-host functionality. Users can now be promoted to co-host status, which gives them elevated permissions (between regular guests and full hosts).

---

## What's Already Implemented (Frontend)

✅ **Context Functions Added:**

- `makeCoHost(participantId: string)` - Emits `make-cohost` socket event
- `removeCoHost(participantId: string)` - Emits `remove-cohost` socket event

✅ **Participant Interface Updated:**

- Added `isCoHost?: boolean` field to Participant type

✅ **UI Changes:**

- Co-host badge displayed with 🤝 emoji (blue)
- "Make Co-Host" option in 3-dots menu
- "Remove Co-Host" option in 3-dots menu
- Co-host status shown as "Co-Host" label instead of "Guest"

---

## Required Backend Implementation

### 1. Room/Participant Schema Update

Add `isCoHost` field to participant data:

```javascript
// Participant Schema
{
  id: string,
  name: string,
  imageUrl?: string,
  isHost: boolean,
  isCoHost: boolean,  // ← NEW FIELD
  isAudioMuted: boolean,
  isVideoPaused: boolean,
  // ... other fields
}

// Room Schema - Add co-host tracking
{
  roomId: string,
  hostId: string,
  coHostIds: string[],  // ← NEW: Array of co-host user IDs
  participants: Map<socketId, Participant>,
  // ... other fields
}
```

---

### 2. Socket Event Handlers

#### Event 1: `make-cohost`

**Frontend emits:**

```typescript
socket.emit("make-cohost", {
  roomId: string,
  participantId: string,
});
```

**Backend handler:**

```javascript
socket.on("make-cohost", async ({ roomId, participantId }) => {
  // 1. Verify authorization (only host can make co-hosts)
  const participant = getParticipant(socket.id);
  if (!participant || !participant.isHost) {
    socket.emit("error", { message: "Only hosts can promote co-hosts" });
    return;
  }

  // 2. Get room
  const room = getRoom(roomId);
  if (!room) {
    socket.emit("error", { message: "Room not found" });
    return;
  }

  // 3. Find target participant
  const targetParticipant = room.participants.get(participantId);
  if (!targetParticipant) {
    socket.emit("error", { message: "Participant not found" });
    return;
  }

  // 4. Update participant status
  targetParticipant.isCoHost = true;

  // 5. Add to room's co-host list
  if (!room.coHostIds.includes(participantId)) {
    room.coHostIds.push(participantId);
  }

  // 6. Broadcast to all participants in room
  io.to(roomId).emit("participant-updated", {
    participantId,
    updates: {
      isCoHost: true,
    },
  });

  // 7. Notify the promoted user
  io.to(participantId).emit("cohost-granted", {
    by: participant.name || "Host",
  });

  // 8. Confirm to host
  socket.emit("success", { message: "Co-host status granted" });

  console.log(`👥 ${participantId} promoted to co-host by ${socket.id}`);
});
```

---

#### Event 2: `remove-cohost`

**Frontend emits:**

```typescript
socket.emit("remove-cohost", {
  roomId: string,
  participantId: string,
});
```

**Backend handler:**

```javascript
socket.on("remove-cohost", async ({ roomId, participantId }) => {
  // 1. Verify authorization (only host can remove co-hosts)
  const participant = getParticipant(socket.id);
  if (!participant || !participant.isHost) {
    socket.emit("error", { message: "Only hosts can remove co-hosts" });
    return;
  }

  // 2. Get room
  const room = getRoom(roomId);
  if (!room) {
    socket.emit("error", { message: "Room not found" });
    return;
  }

  // 3. Find target participant
  const targetParticipant = room.participants.get(participantId);
  if (!targetParticipant) {
    socket.emit("error", { message: "Participant not found" });
    return;
  }

  // 4. Update participant status
  targetParticipant.isCoHost = false;

  // 5. Remove from room's co-host list
  room.coHostIds = room.coHostIds.filter((id) => id !== participantId);

  // 6. Broadcast to all participants in room
  io.to(roomId).emit("participant-updated", {
    participantId,
    updates: {
      isCoHost: false,
    },
  });

  // 7. Notify the demoted user
  io.to(participantId).emit("cohost-revoked", {
    by: participant.name || "Host",
  });

  // 8. Confirm to host
  socket.emit("success", { message: "Co-host status removed" });

  console.log(`👥 ${participantId} demoted from co-host by ${socket.id}`);
});
```

---

### 3. Update Existing Events

#### Update `join-room` to include isCoHost

When sending participant lists, include the `isCoHost` field:

```javascript
socket.on("join-room", async ({ roomId, userId, userName }) => {
  // ... existing join logic

  // Send existing participants (with co-host status)
  const participantsList = Array.from(room.participants.values()).map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    isHost: p.isHost,
    isCoHost: p.isCoHost || false, // ← Include co-host status
    isAudioMuted: p.isAudioMuted,
    isVideoPaused: p.isVideoPaused,
  }));

  socket.emit("existing-participants", participantsList);

  // ... rest of join logic
});
```

#### Update `participant-joined` broadcasts

```javascript
// When broadcasting new participant
io.to(roomId).emit("participant-joined", {
  id: newParticipant.id,
  name: newParticipant.name,
  imageUrl: newParticipant.imageUrl,
  isHost: newParticipant.isHost,
  isCoHost: newParticipant.isCoHost || false, // ← Include
  isAudioMuted: true,
  isVideoPaused: true,
});
```

---

### 4. Permission Checks (Optional Enhancement)

You may want co-hosts to have some elevated permissions. Update permission checks:

```javascript
// Helper function
const hasModeratorPermissions = (participant) => {
  return participant.isHost || participant.isCoHost;
};

// Example: Allow co-hosts to mute others
socket.on("host-control-participant", async ({ userId, type, disable }) => {
  const sender = getParticipant(socket.id);

  // Check if sender is host OR co-host
  if (!hasModeratorPermissions(sender)) {
    socket.emit("error", { message: "Unauthorized" });
    return;
  }

  // ... proceed with control action
});
```

**Permissions you might grant to co-hosts:**

- ✅ Mute participants
- ✅ Disable cameras
- ✅ Stop screen shares
- ❌ Make/remove other co-hosts (host only)
- ❌ Remove participants from call (host only)
- ❌ End meeting for all (host only)

---

## Frontend Socket Listeners Needed

The frontend should listen for these events (add to MediasoupContext):

### 1. `participant-updated`

```typescript
socket.on("participant-updated", ({ participantId, updates }) => {
  setParticipants((prev) =>
    prev.map((p) => (p.id === participantId ? { ...p, ...updates } : p))
  );
});
```

### 2. `cohost-granted`

```typescript
socket.on("cohost-granted", ({ by }) => {
  toast.success(`${by} made you a co-host!`);
  // Could update local isCoHost status if needed
});
```

### 3. `cohost-revoked`

```typescript
socket.on("cohost-revoked", ({ by }) => {
  toast.info(`${by} removed your co-host status`);
  // Could update local isCoHost status if needed
});
```

---

## Testing Checklist

### Basic Functionality

- [ ] Host can promote regular participant to co-host
- [ ] Host can demote co-host to regular participant
- [ ] Co-host badge (🤝) displays correctly in participant list
- [ ] Co-host label shows instead of "Guest"
- [ ] Non-hosts cannot promote/demote co-hosts

### State Synchronization

- [ ] All participants see co-host badge when someone is promoted
- [ ] Co-host status persists if user reconnects (if you implement persistence)
- [ ] New joiners receive correct co-host status for existing participants
- [ ] Co-host status updates in real-time across all clients

### Permissions (if implementing)

- [ ] Co-hosts can mute participants
- [ ] Co-hosts can disable cameras
- [ ] Co-hosts can stop screen shares
- [ ] Co-hosts CANNOT promote other co-hosts
- [ ] Co-hosts CANNOT remove participants

### Edge Cases

- [ ] Cannot promote host to co-host (they're already host)
- [ ] Cannot promote yourself if you're not host
- [ ] Co-host status removed when participant leaves
- [ ] Multiple co-hosts can exist simultaneously
- [ ] Co-host becomes regular participant if host makes someone else the main host

---

## Security Considerations

### ✅ Must Implement

1. **Authorization checks** - Only hosts can make/remove co-hosts
2. **Room verification** - Verify room exists and user is in room
3. **Target validation** - Verify target participant exists in room
4. **No self-promotion** - Users cannot make themselves co-host

### ⚠️ Prevent

- Non-hosts changing co-host status
- Co-hosts promoting themselves to host
- Co-hosts removing other co-hosts (unless you allow this)
- Race conditions with multiple hosts

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Host clicks "Make Co-Host" in UI                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Frontend emits: make-cohost                              │
│    { roomId, participantId }                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Backend verifies authorization                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Backend updates participant.isCoHost = true              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Backend broadcasts: participant-updated to ALL           │
│    { participantId, updates: { isCoHost: true } }           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Backend emits: cohost-granted to TARGET USER             │
│    { by: 'Host Name' }                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. All clients update UI to show co-host badge             │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

**Frontend is ready and waiting for:**

1. `make-cohost` socket event handler
2. `remove-cohost` socket event handler
3. `participant-updated` broadcast when co-host status changes
4. Optional: `cohost-granted` and `cohost-revoked` notifications
5. Include `isCoHost` in all participant data sent to clients

**Estimated Backend Implementation Time:** 2-3 hours

**Priority:** Medium (nice-to-have feature, not critical for core functionality)

Once backend is implemented, the frontend will automatically display co-host badges and allow hosts to manage co-host permissions through the participant list dropdown menu.
