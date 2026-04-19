import React, { useMemo } from "react";
import { useGame } from "@/contexts/GameContext";
import { CommandIcon } from "@/components/ui/CommandIcon";
import { getDirectionSet } from "@/lib/notation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChipTooltipContent } from "@/components/ui/chip-tooltip";
import { cn } from "@/lib/utils";

/**
 * Render a single direction token as text (used for notation styles whose
 * directions are letter codes like `F` / `UF`, which don't have artwork).
 */
const DirectionChip = React.memo(
  ({ token, isHeld }: { token: string; isHeld: boolean }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center justify-center font-bold align-middle font-sans rounded cursor-default",
            "min-w-5 h-5 px-1 text-[13px] relative z-10 border",
            // Direction pill uses a distinct, quieter palette so it reads as
            // input-flavoured but doesn't compete with bright button pills.
            isHeld
              ? "bg-sky-600 text-white border-white"
              : "bg-zinc-800 text-zinc-100 border-zinc-500",
          )}
        >
          {token}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <ChipTooltipContent
          code={token}
          title={isHeld ? `Held ${token}` : `${token} direction`}
          description={
            isHeld ? "Hold the direction until the move comes out." : undefined
          }
        />
      </TooltipContent>
    </Tooltip>
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

  /**
   * Peek at the token that will be rendered *after* the one at (i, j), and
   * tell the caller whether it's a normal button. Used exclusively to decide
   * whether a slide pill should pull its right-hand neighbour leftward for
   * the overlap look — slide → normal overlaps, slide → anything else does
   * not (so slide-next-to-slide, trailing slide, slide-before-separator all
   * render tidily side-by-side).
   */
  const peekNextIsNormalButton = (i: number, j: number): boolean => {
    let nextRaw: string | undefined;
    // First try the next "+"-separated chunk within the same command part.
    if (j + 1 < buttons.length) {
      nextRaw = buttons[j + 1];
    } else if (i + 1 < command.length) {
      // Fall through to the first chunk of the next command part.
      const nextPart = command[i + 1];
      nextRaw = nextPart?.split("+")[0];
    }
    if (!nextRaw) return false;
    // Strip held-button parens.
    const stripped = nextRaw.replace(/[()]/g, "");
    if (!stripped || stripped === "_") return false;
    // Directions in the active style aren't buttons.
    if (directionSet.has(stripped)) return false;
    // Slides are flagged by lowercase first char.
    const c = stripped[0];
    if (c >= "a" && c <= "z") return false;
    return true;
  };

  const parts: React.ReactNode[] = [];
  let buttons: string[] = [];

  for (let i = 0; i < command.length; i++) {
    const commandPart = command[i];

    // Split by + to get individual buttons in this command part. Assigning
    // (not re-declaring) so `peekNextIsNormalButton` above can close over
    // the current iteration's array.
    buttons = commandPart.split("+");

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
          overlapNext={isSlide && peekNextIsNormalButton(i, j)}
        />,
      );
    }
  }

  return <span className="inline-flex items-center flex-wrap">{parts}</span>;
};

// Memoize to prevent re-renders during table virtualization transitions
export const CommandRenderer = React.memo(CommandRendererInner);
