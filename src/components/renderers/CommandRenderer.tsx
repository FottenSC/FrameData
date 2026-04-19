import React, { useMemo } from "react";
import { useGame } from "@/contexts/GameContext";
import { CommandIcon } from "@/components/ui/CommandIcon";
import { DirectionChip } from "@/components/ui/direction-chip";
import {
  expandMotionShorthand,
  getDirectionSet,
  isMotionShorthand,
  translateCommand,
  translateToken,
} from "@/lib/notation";

/**
 * A command is a list of ordered "steps"; each step is itself a list of
 * alternative tokens the player may choose from (single-alt steps are the
 * common case, OR-steps like `(3)_(6)_(9)` are multi-alt).
 *
 * The incoming `command` is always in the *authored universal* form (ABCD
 * + numpad directions). We translate it through the active notation style
 * here — the one place that actually cares about display — rather than
 * persisting a per-style snapshot in the data layer. That way flipping
 * notations costs a React re-render and nothing else; no refetch, no
 * re-process of Move objects.
 */
const CommandRendererInner: React.FC<{ command: string[][] | null }> = ({
  command,
}) => {
  const { getIconUrl, notationStyle } = useGame();

  // Translate once per (command, style). `translateCommand` memoises at
  // the token level, so this is cheap even in a virtualised table — each
  // unique raw token gets regex-replaced exactly once per style.
  const styledCommand = useMemo(
    () => translateCommand(command, notationStyle),
    [command, notationStyle],
  );

  // Whether a given token is a direction is style-dependent — Tekken
  // notation uses letter codes, numpad styles use 1–9. Memoised against the
  // active style so it's a single Set allocation per style change.
  const directionSet = useMemo(
    () => getDirectionSet(notationStyle),
    [notationStyle],
  );
  const directionMode = notationStyle?.directionRenderMode ?? "icon";

  if (!styledCommand || styledCommand.length === 0) return <>—</>;

  /**
   * Does the token at (stepIdx, altIdx, buttonIdx) end in a slide that wants
   * to overlap its right-hand neighbour? The overlap only looks right when
   * the neighbour is a normal button; next-is-direction / next-is-slide /
   * next-is-OR-boundary all render tidily without the pull-leftward tweak.
   *
   * We only peek *inside the same alternative branch* — reaching across an
   * OR-step would be confusing because those tokens are mutually exclusive.
   */
  const peekNextIsNormalButton = (
    stepIdx: number,
    altIdx: number,
    buttons: string[],
    buttonIdx: number,
  ): boolean => {
    let nextRaw: string | undefined;
    if (buttonIdx + 1 < buttons.length) {
      // Same "+"-chunk continues.
      nextRaw = buttons[buttonIdx + 1];
    } else if (stepIdx + 1 < styledCommand.length) {
      // Fall through to the next step. For multi-alt steps, the overlap
      // logic isn't meaningful (you don't know which alt the player picks),
      // so only pull leftward when the next step is single-alt.
      const nextStep = styledCommand[stepIdx + 1];
      if (nextStep.length !== 1) return false;
      nextRaw = nextStep[0].split("+")[0];
    }
    if (!nextRaw) return false;
    const stripped = nextRaw.replace(/[()]/g, "");
    if (!stripped || stripped === "_") return false;
    if (directionSet.has(stripped)) return false;
    const c = stripped[0];
    if (c >= "a" && c <= "z") return false;
    // Ignore altIdx — overlap calc doesn't depend on which branch we came from.
    void altIdx;
    return true;
  };

  // Outer list of STEPS. Each step becomes one `inline-flex` flex-child in
  // the outermost `flex-wrap` container, which means the command can wrap
  // between steps (long commands break onto multiple lines gracefully) but
  // the alternatives inside an OR-step — and the buttons inside an A+G
  // compound — stay cohesively on one line.
  const parts: React.ReactNode[] = [];

  /**
   * Append the rendered pieces of a single token (one alternative of one
   * step) to the provided buffer. A token may contain multiple `+`-joined
   * buttons (like `A+G`), so this may push several pills and a `+` icon.
   */
  const renderTokenInto = (
    out: React.ReactNode[],
    token: string,
    stepIdx: number,
    altIdx: number,
    tokenBranchKey: string,
  ): void => {
    const buttons = token.split("+");

    for (let j = 0; j < buttons.length; j++) {
      const buttonStr = buttons[j];
      if (!buttonStr) continue;

      // "+" separator between buttons in the same "A+G" / "B+K" chunk.
      if (j > 0) {
        out.push(
          <span
            key={`plus-${tokenBranchKey}-${j}`}
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

      // Parse individual button.
      let button = buttonStr;
      let isHeld = false;
      let isSlide = false;

      // Held button (parens).
      if (button[0] === "(") {
        isHeld = true;
        button = button.replace(/[()]/g, "");
      }
      if (!button) continue;

      // Motion shorthand (qcf / qcb / hcf / hcb / dp). Two cases:
      //
      //  1. The active style lists this shorthand in its directionTokens
      //     (Tekken FBUD does). We draw one compact chip with the literal
      //     label and let the tooltip show the expansion.
      //
      //  2. Any other style — numpad, universal, ABKG — doesn't recognise
      //     the shorthand as a direction, so we expand it inline into its
      //     component numpad arrows. Each expanded arrow is then translated
      //     through the current style (numpad stays numpad; nothing else
      //     has a rule for "2"/"3"/etc. so they pass through), so a `qcf`
      //     token renders as "↓ ↘ →" in numpad mode — exactly what the
      //     user would see if the data had been authored with three steps.
      if (isMotionShorthand(button)) {
        const expansion = expandMotionShorthand(button) ?? [];
        if (directionSet.has(button)) {
          out.push(
            <DirectionChip
              key={`motion-${tokenBranchKey}-${j}-${button}`}
              token={button}
              isHeld={isHeld}
              expansion={expansion}
            />,
          );
        } else {
          // Inline expansion: render each component as a direction under
          // the current style. Tokens without a notation mapping (numpad
          // in universal, for example) pass through translateToken cleanly.
          expansion.forEach((numpadTok, idx) => {
            const mapped = translateToken(numpadTok, notationStyle);
            if (directionMode === "text") {
              out.push(
                <DirectionChip
                  key={`motion-exp-${tokenBranchKey}-${j}-${idx}-${mapped}`}
                  token={mapped}
                  isHeld={isHeld}
                />,
              );
            } else {
              const iconUrl = getIconUrl(mapped, isHeld);
              out.push(
                <img
                  key={`motion-exp-${tokenBranchKey}-${j}-${idx}-${mapped}`}
                  src={iconUrl}
                  alt={mapped}
                  className="inline object-contain align-text-bottom h-4 w-4"
                />,
              );
            }
          });
        }
        continue;
      }

      // Directions are style-dependent — check against the ACTIVE notation
      // direction set rather than naively "starts with a digit".
      if (directionSet.has(button)) {
        if (directionMode === "text") {
          out.push(
            <DirectionChip
              key={`direction-${tokenBranchKey}-${j}-${button}`}
              token={button}
              isHeld={isHeld}
            />,
          );
        } else {
          const iconUrl = getIconUrl(button, isHeld);
          out.push(
            <img
              key={`direction-${tokenBranchKey}-${j}-${button}`}
              src={iconUrl}
              alt={button}
              className="inline object-contain align-text-bottom h-4 w-4"
            />,
          );
        }
        continue;
      }

      // Slide if the first char is a lowercase letter.
      const first = button[0];
      if (first >= "a" && first <= "z") {
        isSlide = true;
      }
      out.push(
        <CommandIcon
          key={`command-${tokenBranchKey}-${j}-${button}`}
          input={button}
          isHeld={isHeld}
          isSlide={isSlide}
          overlapNext={
            isSlide && peekNextIsNormalButton(stepIdx, altIdx, buttons, j)
          }
        />,
      );
    }
  };

  for (let i = 0; i < styledCommand.length; i++) {
    const step = styledCommand[i];
    if (!step || step.length === 0) continue;

    // Per-step buffer. Alternatives and their OR-dividers live here, then
    // get wrapped in ONE flex-child that doesn't wrap internally.
    const stepChildren: React.ReactNode[] = [];

    for (let a = 0; a < step.length; a++) {
      // Visual "or" divider between alternatives within an OR-step. Matches
      // the old underscore-separator styling so multi-alt inputs render
      // with the same vertical bar users are used to.
      if (a > 0) {
        stepChildren.push(
          <span
            key={`or-${i}-${a}`}
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
      }
      renderTokenInto(stepChildren, step[a], i, a, `${i}-${a}`);
    }

    if (stepChildren.length === 0) continue;

    // One flex-child per STEP. No `flex-wrap` here — OR alternatives must
    // stay on one line together so `(DF) | (F) | (UF)` reads as a single
    // "choose one of these" group. Line breaks happen between steps, not
    // inside them.
    parts.push(
      <span
        key={`step-${i}`}
        className="inline-flex items-center"
      >
        {stepChildren}
      </span>,
    );
  }

  return <span className="inline-flex items-center flex-wrap">{parts}</span>;
};

// Memoize to prevent re-renders during table virtualization transitions
export const CommandRenderer = React.memo(CommandRendererInner);
