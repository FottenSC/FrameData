import React, { useMemo } from "react";
import { useGame } from "@/contexts/GameContext";
import { CommandIcon } from "@/components/ui/CommandIcon";
import { DirectionChip } from "@/components/ui/direction-chip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChipTooltipContent } from "@/components/ui/chip-tooltip";
import { cn } from "@/lib/utils";
import {
  expandMotionShorthand,
  getDirectionSet,
  isMotionShorthand,
  MOTION_TITLES,
  translateCommand,
  translateToken,
} from "@/lib/notation";
import type { Command, CommandButton, CommandPress } from "@/types/Move";

/**
 * A command is a three-level list: STEPS (sequential) → ALTERNATIVES (the
 * OR-branches inside a step) → BUTTONS (the simultaneously-pressed inputs
 * that make up one alternative, e.g. `A+B` is `[{b:"A"},{b:"B"}]`). Each
 * leaf is a {@link CommandButton} — `{b}` for a plain press, `{b,h:true}`
 * for a held one — so the renderer reads structural state instead of
 * stripping parens out of strings.
 *
 * The incoming `command` is always in the *authored universal* form (ABCD
 * + numpad directions). We translate it through the active notation style
 * here — the one place that actually cares about display — rather than
 * persisting a per-style snapshot in the data layer. That way flipping
 * notations costs a React re-render and nothing else; no refetch, no
 * re-process of Move objects.
 */
const CommandRendererInner: React.FC<{ command: Command | null }> = ({
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
   * Render a numpad-direction icon as a Tooltip-wrapped image. Same
   * tooltip shape as DirectionChip (text-mode direction) so hovering
   * any direction — image or text — produces a consistent affordance.
   * The tooltip title resolves to the motion-shorthand description
   * when the token IS a shorthand (qcf / hcb / dp / …) and otherwise
   * falls back to "<token> direction" / "Held <token>".
   */
  const renderImageDirection = (
    token: string,
    held: boolean,
    key: string,
  ): React.ReactNode => {
    const iconUrl = getIconUrl(token, held);
    const motionTitle = MOTION_TITLES[token.toLowerCase()];
    const title = held
      ? `Held ${token}`
      : motionTitle
        ? motionTitle
        : `${token} direction`;
    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>
          <img
            src={iconUrl}
            alt={token}
            // Match the letter-button box (h-5 w-5 = 20×20) so a
            // direction reads as the same visual weight as the button
            // glyph that follows it. `shrink-0` prevents flex
            // compression when many icons sit on the same line.
            className="block object-contain shrink-0 h-5 w-5 cursor-default"
          />
        </TooltipTrigger>
        <TooltipContent>
          <ChipTooltipContent code={token} title={title} />
        </TooltipContent>
      </Tooltip>
    );
  };

  /**
   * Does the button at (stepIdx, altIdx, buttonIdx) end in a slide that wants
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
    buttons: CommandPress,
    buttonIdx: number,
  ): boolean => {
    let next: CommandButton | undefined;
    if (buttonIdx + 1 < buttons.length) {
      // Same alternative continues — peek into its next button.
      next = buttons[buttonIdx + 1];
    } else if (stepIdx + 1 < styledCommand.length) {
      // Fall through to the next step. For multi-alt steps, the overlap
      // logic isn't meaningful (you don't know which alt the player picks),
      // so only pull leftward when the next step is single-alt.
      const nextStep = styledCommand[stepIdx + 1];
      if (nextStep.length !== 1) return false;
      next = nextStep[0][0];
    }
    if (!next || !next.b) return false;
    if (directionSet.has(next.b)) return false;
    const c = next.b[0];
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
   * Append the rendered pieces of a single alternative (one OR-branch of one
   * step) to the provided buffer. An alternative is an array of
   * simultaneously-pressed {@link CommandButton}s; rendering an `A+G`
   * AND-press iterates the two-element list, pushing a pill for each and
   * a `+` separator icon between them.
   */
  const renderAltInto = (
    out: React.ReactNode[],
    buttons: CommandPress,
    stepIdx: number,
    altIdx: number,
    tokenBranchKey: string,
  ): void => {
    for (let j = 0; j < buttons.length; j++) {
      const btn = buttons[j];
      if (!btn || !btn.b) continue;

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

      const token = btn.b;
      const isHeld = btn.h === true;

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
      if (isMotionShorthand(token)) {
        const expansion = expandMotionShorthand(token) ?? [];
        if (directionSet.has(token)) {
          out.push(
            <DirectionChip
              key={`motion-${tokenBranchKey}-${j}-${token}`}
              token={token}
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
              out.push(
                renderImageDirection(
                  mapped,
                  isHeld,
                  `motion-exp-${tokenBranchKey}-${j}-${idx}-${mapped}`,
                ),
              );
            }
          });
        }
        continue;
      }

      // Directions are style-dependent — check against the ACTIVE notation
      // direction set rather than naively "starts with a digit".
      if (directionSet.has(token)) {
        if (directionMode === "text") {
          out.push(
            <DirectionChip
              key={`direction-${tokenBranchKey}-${j}-${token}`}
              token={token}
              isHeld={isHeld}
            />,
          );
        } else {
          out.push(
            renderImageDirection(
              token,
              isHeld,
              `direction-${tokenBranchKey}-${j}-${token}`,
            ),
          );
        }
        continue;
      }

      // Slide if the first char is a lowercase letter.
      const isSlide = token[0] >= "a" && token[0] <= "z";
      out.push(
        <CommandIcon
          key={`command-${tokenBranchKey}-${j}-${token}`}
          input={token}
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
    const isOrGroup = step.length > 1;

    for (let a = 0; a < step.length; a++) {
      // Visual "or" divider between alternatives within an OR-step.
      // Container height matches the letter-button pill (h-5 = 20px) so
      // the bar reads as a strong "choose one" signal between
      // alternatives instead of looking like a thin tick. The bar
      // itself spans nearly the full pill height.
      if (a > 0) {
        stepChildren.push(
          <span
            key={`or-${i}-${a}`}
            className="relative inline-flex items-center justify-center w-3 h-5 mx-[-4px] z-20 align-middle underscore-separator"
            aria-hidden
          >
            <span className="text-transparent select-text leading-none">_</span>
            <svg
              width="10"
              height="20"
              viewBox="0 0 10 20"
              className="absolute inset-0 m-auto block pointer-events-none text-muted-foreground"
              aria-hidden
            >
              <path
                d="M5 2 v16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>,
        );
      }
      renderAltInto(stepChildren, step[a], i, a, `${i}-${a}`);
    }

    if (stepChildren.length === 0) continue;

    // One flex-child per STEP.
    //   - `inline-flex` + no `flex-wrap`: OR alternatives must stay on
    //     one line together so `(DF) | (F) | (UF)` reads as a single
    //     "choose one of these" group. Line breaks happen between steps.
    //   - `whitespace-nowrap`: belt-and-braces against any inline text
    //     inside an alternative wrapping mid-step.
    //   - `items-center`: vertical centring works because every
    //     CommandIcon child is the same h-5 height now (slides have an
    //     outer h-5 wrapper with the visible 14px pill anchored at the
    //     bottom; see CommandIcon.tsx). With items-end the small `+`
    //     separator pill (h-3) bottom-aligned to the row instead of
    //     sitting at the buttons' vertical centre — items-center keeps
    //     the separator visually between the two buttons it joins.
    //   - For OR-groups (length > 1) we wrap the alternatives in a
    //     subtle bordered pill so the visual scope of "these are
    //     options for this one input" is unmistakable. Plain
    //     single-alt steps render unwrapped to stay compact.
    parts.push(
      <span
        key={`step-${i}`}
        className={cn(
          "inline-flex items-center whitespace-nowrap",
          isOrGroup &&
            "rounded-md border border-border/50 bg-muted/20 px-1.5 py-0.5",
        )}
      >
        {stepChildren}
      </span>,
    );
  }

  // Outer wrapper uses `items-center`: each step (already a
  // bottom-aligning flex container internally) is vertically centered
  // within its line. This keeps the command row visually centered in
  // the table cell rather than sinking to the bottom edge.
  // Within-step alignment (slide vs normal pills sharing a baseline)
  // is handled by `items-end` on the per-step container above; the
  // outer container only decides where the whole line sits.
  return <span className="inline-flex items-center flex-wrap">{parts}</span>;
};

// Memoize to prevent re-renders during table virtualization transitions
export const CommandRenderer = React.memo(CommandRendererInner);
