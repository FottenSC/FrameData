import React, { memo, useMemo } from "react";
import { useGame } from "@/contexts/GameContext";
import { CommandIcon } from "@/components/ui/CommandIcon";

const CommandRendererInner: React.FC<{ command: string | null }> = ({
  command,
}) => {
  const { getIconUrl } = useGame();

  const parts = useMemo(() => {
    if (!command) return null;

    const result: React.ReactNode[] = [];
    const commandArray = command.match(/(?<=:)[^:]+(?=:)/g) || [];
    for (let i = 0; i < commandArray.length; i++) {
      let isSlide = false;
      let isHeld = false;
      const buttons = commandArray[i];
      let buttonIndex = 0;
      for (let b of buttons.split("+")) {
        let button = b;
        if (buttonIndex > 0) {
          result.push(
            <span
              key={`plus-${i}-${buttonIndex}`}
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
            </span>,
          );
        }

        if (button[0] === "(") {
          isHeld = true;
          button = button.replace(/[()]/g, "");
        }

        if (button === "_") {
          result.push(
            <span
              key={`separator-${i}-${buttonIndex}`}
              className="inline-flex items-center flex-wrap ml-[-1px] mr-[-1px]"
            >
              |
            </span>,
          );
        } else if (!isNaN(button[0] as any)) {
          const iconUrl = getIconUrl(button, isHeld);
          result.push(
            <img
              key={`direction-${i}-${buttonIndex}-${button}`}
              src={iconUrl}
              alt={button}
              className="inline object-contain align-text-bottom h-4 w-4"
            />,
          );
        } else {
          if (button[0] === button[0].toLowerCase()) {
            isSlide = true;
          }
          result.push(
            <CommandIcon
              key={`command-${i}-${buttonIndex}-${button}`}
              input={button}
              isHeld={isHeld}
              isSlide={isSlide}
            />,
          );
        }
        buttonIndex++;
      }
    }
    return result;
  }, [command, getIconUrl]);

  if (!command) return <>—</>;

  return <span className="inline-flex items-center flex-wrap">{parts}</span>;
};

// Memoize to prevent re-renders during table virtualization transitions
export const CommandRenderer = memo(CommandRendererInner);
