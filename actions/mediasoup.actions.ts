'use server';

import { currentUser } from '@clerk/nextjs/server';

// ✅ You'll use this to verify if a user is allowed to join a room
// and to fetch meeting details from your DB (Prisma, MongoDB, etc.)
export const getMeetingPermissions = async (roomId: string) => {
  const user = await currentUser();

  if (!user) throw new Error('User is not authenticated');

  // Logic: Check your DB to see if 'roomId' exists and if the user is invited
  // const meeting = await db.meeting.findUnique({ where: { id: roomId } });
  
  return {
    userId: user.id,
    userName: user.username || user.firstName,
    canProduce: true, // Permission to share cam/mic
    canConsume: true, // Permission to see others
    isOwner: true     // You can determine this by comparing user.id with meeting.creatorId
  };
};