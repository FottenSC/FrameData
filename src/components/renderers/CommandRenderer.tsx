import React from "react";
import { useGame } from "@/contexts/GameContext";
import { CommandIcon } from "@/components/ui/CommandIcon";

const CommandRendererInner: React.FC<{ command: string[] | null }> = ({
  command,
}) => {
  const { getIconUrl } = useGame();

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
            <span className="text-transparent select-text leading-none">
              +
            </span>
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
          </span>
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

      // Handle separator (→ between command groups)
      if (button === "_") {
        parts.push(
          <span
            key={`separator-${i}-${j}`}
            className="relative inline-flex items-center justify-center w-3 h-4 mx-[-5px] z-20 align-middle underscore-separator"
          >
            <span className="text-transparent select-text leading-none">
              _
            </span>
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
          </span>
        );
      }
      // Handle directional input (starts with digit)
      else if (!isNaN(button[0] as any)) {
        const iconUrl = getIconUrl(button, isHeld);
        parts.push(
          <img
            key={`direction-${i}-${j}-${button}`}
            src={iconUrl}
            alt={button}
            className="inline object-contain align-text-bottom h-4 w-4"
          />
        );
      }
      // Handle button command
      else {
        if (button[0] === button[0].toLowerCase()) {
          isSlide = true;
        }
        parts.push(
          <CommandIcon
            key={`command-${i}-${j}-${button}`}
            input={button}
            isHeld={isHeld}
            isSlide={isSlide}
          />
        );
      }
    }
  }

  return <span className="inline-flex items-center flex-wrap">{parts}</span>;
};

// Memoize to prevent re-renders during table virtualization transitions
export const CommandRenderer = CommandRendererInner;
