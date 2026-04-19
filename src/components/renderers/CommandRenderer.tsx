import React, { useMemo } from "react";
import { useGame } from "@/contexts/GameContext";
import { CommandIcon } from "@/components/ui/CommandIcon";
import { getDirectionSet } from "@/lib/notation";
import { cn } from "@/lib/utils";

/**
 * Render a single direction token as text (used for notation styles whose
 * directions are letter codes like `F` / `UF`, which don't have artwork).
 */
const DirectionChip = React.memo(
  ({ token, isHeld }: { token: string; isHeld: boolean }) => (
    <div
      className={cn(
        "inline-flex items-center justify-center font-bold align-middle font-sans rounded",
        "min-w-5 h-5 px-1 text-[13px] relative z-10 border",
        // Direction pill uses a distinct, quieter palette so it reads as
        // input-flavoured but doesn't compete with bright button pills.
        isHeld
          ? "bg-sky-600 text-white border-white"
          : "bg-zinc-800 text-zinc-100 border-zinc-500",
      )}
      title={`${token}${isHeld ? " (held)" : ""}`}
    >
      {token}
    </div>
  ),
);
DirectionChip.displayName = "DirectionChip";

const CommandRendererInner: React.FC<{ command: string[] | null }> = ({
  command,
}) => {
  const { getIconUrl, notationStyle } = useGame();

  // Whether a given token is a direction is style-dependent — Tekken
  // notation uses letter codes, numpad styles use 1–9. Memoised against the
  // active style so it's a single Set allocation per style change.
  const directionSet = useMemo(
    () => getDirectionSet(notationStyle),
    [notationStyle],
  );
  const directionMode = notationStyle?.directionRenderMode ?? "icon";

  if (!command || command.length === 0) return <>—</>;

  const parts: React.ReactNode[] = [];

  for (let i = 0; i < command.length; i++) {
    const commandPart = command[i];

    // Split by + to get individual buttons in this command part
    const buttons = commandPart.split("+");

    for (let j = 0; j < buttons.length; j++) {
      const buttonStr = buttons[j];
      if (!buttonStr) continue;

      // Add + separator between buttons within same command
      if (j > 0) {
        parts.push(
          <span
            key={`plus-${i}-${j}`}
            className="relative inline-flex items-center justify-center w-3 h-3 border border-black bg-white text-black rounded-full mx-[-5px] z-20 align-middle plus-separator"
          >
            <span className="text-transparent select-text leading-none">+</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              className="absolute inset-0 m-auto block pointer-events-none"
              aria-hidden
            >
              <path
                d="M5 2 v6 M2 5 h6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>,
        );
      }

      // Parse individual button
      let button = buttonStr;
      let isHeld = false;
      let isSlide = false;

      // Check for held button (parentheses)
      if (button[0] === "(") {
        isHeld = true;
        button = button.replace(/[()]/g, "");
      }

      if (!button) continue;

      // Separator token between command groups ("_" in source data).
      if (button === "_") {
        parts.push(
          <span
            key={`separator-${i}-${j}`}
            className="relative inline-flex items-center justify-center w-3 h-4 mx-[-5px] z-20 align-middle underscore-separator"
          >
            <span className="text-transparent select-text leading-none">_</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              className="absolute inset-0 m-auto block pointer-events-none text-muted-foreground"
              aria-hidden
            >
              <path
                d="M5 2 v6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>,
        );
        continue;
      }

      // Direction? Check against the ACTIVE notation style's direction set
      // — not a naive "starts with a digit" check, because Tekken-style
      // notations put digits on buttons (1/2/3/4).
      if (directionSet.has(button)) {
        if (directionMode === "text") {
          parts.push(
            <DirectionChip
              key={`direction-${i}-${j}-${button}`}
              token={button}
              isHeld={isHeld}
            />,
          );
        } else {
          const iconUrl = getIconUrl(button, isHeld);
          parts.push(
            <img
              key={`direction-${i}-${j}-${button}`}
              src={iconUrl}
              alt={button}
              className="inline object-contain align-text-bottom h-4 w-4"
            />,
          );
        }
        continue;
      }

      // Otherwise it's a button. Lowercase LETTER first char = "slide"
      // (source-data convention). Digits / symbols are never slides.
      const first = button[0];
      if (first >= "a" && first <= "z") {
        isSlide = true;
      }
      parts.push(
        <CommandIcon
          key={`command-${i}-${j}-${button}`}
          input={button}
          isHeld={isHeld}
          isSlide={isSlide}
        />,
      );
    }
  }

  return <span className="inline-flex items-center flex-wrap">{parts}</span>;
};

// Memoize to prevent re-renders during table virtualization transitions
export const CommandRenderer = React.memo(CommandRendererInner);
