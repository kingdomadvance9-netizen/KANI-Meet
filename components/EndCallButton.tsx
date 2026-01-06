"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';

interface EndCallButtonProps {
  // PHASE 6: Pass this down from your meeting state/context
  isMeetingOwner?: boolean;
}

const EndCallButton = ({ isMeetingOwner = false }: EndCallButtonProps) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // If the current user didn't start the meeting, don't show the nuclear option
  if (!isMeetingOwner) return null;

  const endCall = async () => {
    try {
      // PHASE 6: 
      // socket.emit('end-meeting-for-all', { roomId });
      
      console.log("Broadcasting end-call signal to all participants...");
      
      // Temporary: just redirect the owner
      router.push('/');
    } catch (error) {
      console.error("Failed to end call:", error);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setOpen(true)} 
        className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
      >
        End call for everyone
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl p-6 bg-[#1c1f2e] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">End meeting for all?</DialogTitle>
          </DialogHeader>

          <p className="text-gray-400 mt-2">
            This will disconnect all participants and close the room permanently.
          </p>

          <DialogFooter className="flex gap-3 mt-8">
            <Button 
              variant="ghost" 
              onClick={() => setOpen(false)}
              className="hover:bg-white/10 text-white"
            >
              Cancel
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white" 
              onClick={endCall}
            >
              Confirm End Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EndCallButton;