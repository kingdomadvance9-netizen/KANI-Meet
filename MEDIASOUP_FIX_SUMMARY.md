# Mediasoup Audio/Video Fix Summary

## Problem

Users could turn on their mic, video, or share screen, but other users couldn't hear, see the video, or see the shared screen.

## Root Cause

**Stream Key Mismatch**: Remote media streams were being stored with **socket IDs** as keys (e.g., `UorVl48KnmTePCBsAAAy`), but when rendering participants, the code was trying to retrieve streams using **user IDs** (e.g., `user_368tpoTLTMreMuTZeWf0C9GC7OF`). This mismatch meant streams never got connected to video/audio elements.

**Server Issue**: The consume response does NOT include `userId` - only `peerId` (socket ID). This makes it impossible to directly map streams to participants without a workaround.

## Client-Side Fixes Implemented

### 1. Automatic Stream-to-User Correlation ⭐ KEY FIX

- **File**: `contexts/MediasoupContext.tsx`
- **WORKAROUND for missing server userId**: When participant list updates with new participants, automatically correlates unmapped streams with new user IDs
- Logic: If a new participant joins and we have an unmapped stream (keyed by socket ID), they're the same person
- Automatically remaps the stream from socket ID key → user ID key
- Logs: `🔄 Remapped stream: <socketId> → <userId>`

### 2. Socket ID → User ID Mapping Cache

- Added `peerIdToUserIdRef` to maintain mapping between socket IDs and user IDs
- Builds mapping from server responses when available
- Falls back to correlation when server doesn't provide mapping

### 3. Hidden Audio Element for Remote Participants

- **File**: `components/MediasoupTile.tsx`
- Added hidden `<audio>` element for remote participants
- Video elements alone don't guarantee audio playback in all browsers
- Explicitly sets audio stream on separate audio element to ensure playback

### 4. Enhanced Logging

- Logs consume response details to verify what server sends
- Shows correlation/remapping actions
- Helps diagnose stream key issues

## Server-Side Requirements

To fully resolve this issue, the server should send `userId` in the following events:

### 1. In `consume` Response

```javascript
socket.emit("consume", { roomId, producerId, rtpCapabilities }, (response) => {
  // response should include:
  {
    id: consumerId,
    producerId: producerId,
    kind: "audio" | "video",
    rtpParameters: {...},
    peerId: socketId,        // Current: socket ID
    userId: clerkUserId      // REQUIRED: Add this!
  }
});
```

### 2. In `new-producer` Event

```javascript
socket.broadcast.to(roomId).emit("new-producer", {
  producerId: producer.id,
  peerId: socket.id, // Current: socket ID
  userId: userClerkId, // REQUIRED: Add this!
  kind: producer.kind,
});
```

### 3. Optional: Add `get-socket-id-for-user` Handler

```javascript
socket.on("get-socket-id-for-user", ({ userId }, callback) => {
  const socketId = userIdToSocketIdMap.get(userId);
  callback({ socketId });
});
```

## Testing Checklist

1. ✅ Check console logs for "🔗 Mapped socket to user" messages
2. ✅ Verify "📊 Response details" shows userId in consume response
3. ✅ Confirm remote streams are keyed by user ID (check "✅ Added audio/video track to stream for userId:")
4. ✅ Test audio playback - should hear remote participants
5. ✅ Test video playback - should see remote participants' video
6. ✅ Test screen sharing - should see shared screens
7. ✅ Test with multiple participants
8. ✅ Test reconnection scenarios

## Expected Log Output (Success)

When the fix works correctly, you should see:

```
👥 Participants updated: (2) [...]
🆕 New participants detected: ['user_368tpoTLTMreMuTZeWf0C9GC7OF']
🔍 Checking for unmapped socket ID streams: ['UorVl48KnmTePCBsAAAy']
🔄 Remapped stream: UorVl48KnmTePCBsAAAy → user_368tpoTLTMreMuTZeWf0C9GC7OF
✅ Stream found for participant: user_368tpoTLTMreMuTZeWf0C9GC7OF tracks: 1
🎬 Setting up MediasoupTile for: Brabyns Yabwetsa isLocal: false
📊 Stream tracks: { audio: 1, video: 0 }
🔊 Setting audio stream for remote participant: Brabyns Yabwetsa
```

**Key indicators the fix is working:**

1. ✅ `🔄 Remapped stream` - Stream was moved from socket ID to user ID
2. ✅ `✅ Stream found for participant` - GridLayout found the stream
3. ✅ `🔊 Setting audio stream` - Audio element received the stream
4. ✅ No `⚠️ No stream found for participant` errors

## Troubleshooting

### If you still can't hear audio:

1. **Check Browser Autoplay Policy**

   - Look for: `⚠️ Audio autoplay blocked`
   - Solution: Click anywhere on the page to enable audio

2. **Verify Stream Mapping**

   - Look for: `🔄 Remapped stream` in console
   - If missing: The correlation logic didn't trigger
   - Check: Number of new participants should equal number of unmapped streams

3. **Check Stream Keys**

   - Look for: `⚠️ No stream found for participant`
   - If present: Stream keys still don't match
   - Debug: Check `📋 Available stream keys` log

4. **Verify Tracks**

   - Look for: `📊 Stream tracks: { audio: 1, video: 0 }`
   - If audio: 0: The producer isn't creating audio
   - Check: Audio permissions and microphone access

5. **Test Audio Element**
   - Open browser DevTools → Elements
   - Find the hidden `<audio>` element
   - Check if it has srcObject set
   - Try manually: `document.querySelector('audio').play()`

## Files Modified

1. [contexts/MediasoupContext.tsx](contexts/MediasoupContext.tsx) - Auto-correlation logic
2. [components/MediasoupTile.tsx](components/MediasoupTile.tsx) - Hidden audio element
3. [components/GridLayout.tsx](components/GridLayout.tsx) - Debug logging

## If Server Cannot Be Modified Immediately

The client-side fixes include fallback logic:

1. Attempts to use `userId` from server response
2. Falls back to socket ID → user ID mapping (if built from other events)
3. Temporarily uses socket ID as key
4. Requests mapping when receiving participant updates

However, **the cleanest solution requires server changes** to include `userId` in consume/producer events.

## Files Modified

1. `contexts/MediasoupContext.tsx` - Main mediasoup logic with mapping
2. `components/MediasoupTile.tsx` - Audio element for remote participants
