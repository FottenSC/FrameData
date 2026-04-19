import React from "react";
import { cn } from "@/lib/utils";

interface CommandIconProps {
  input: string;
  isHeld: boolean;
  isSlide: boolean;
}

export const CommandIcon: React.FC<CommandIconProps> = ({
  input,
  isHeld,
  isSlide,
}) => {
  let baseClasses = "border border-black bg-white text-black rounded";
  let heldClasses = "bg-black text-white border border-white rounded";
  // Slide inputs (lowercase letters in the source) render at a smaller size
  // so they read as a secondary / chained input next to regular button pills.
  const sizeClasses = isSlide
    ? "w-3.5 h-3.5 text-[11px]"
    : "w-5 h-5 text-[16px]";
  // A negative right-margin tucks the slide's right half *under* whatever
  // follows. In practice the thing following a slide is a normal button
  // (e.g. `aB`, `bK`), which then sits half-overlapping the slide — visually
  // communicating "this small input leads into that main press". When a
  // slide happens to be the last element the negative margin is a no-op.
  const marginClasses = isSlide ? "-mr-2" : "mx-0.25";

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center font-bold align-middle font-sans",
        sizeClasses,
        marginClasses,
        isSlide ? "self-end" : "",
        "button-icon",
        "relative z-10",
        isHeld ? heldClasses : baseClasses,
      )}
      title={`${input} Button${isHeld ? " (Held)" : ""}`}
    >
      {input.toUpperCase()}
    </div>
  );
};
