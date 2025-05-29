import React from 'react';
import { cn } from '@/lib/utils';

interface CommandIconProps {
  input: string;
  isHeld: boolean;
  isSlide: boolean;
}

export const CommandIcon = React.memo(({ input, isHeld, isSlide }: CommandIconProps) => {
  let baseClasses = "border border-black bg-white text-black rounded";
  let heldClasses = "bg-black text-white border border-white rounded";
  const sizeClasses = isSlide ? "w-4 h-4 text-[13px]" : "w-5 h-5 text-[16px]";
  const marginClasses = isSlide ? "" : "mx-0.25"; 

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center font-bold align-middle font-sans",
        sizeClasses, 
        marginClasses,
        isSlide ? "self-end" : "",
        "button-icon",
        "relative z-10",
        isHeld ? heldClasses : baseClasses
      )}
      title={`${input} Button${isHeld ? ' (Held)' : ''}`}
    >
      {input.toUpperCase()}
    </div>
  );
}); 