import React, { useMemo } from "react";
import { useGame } from "@/contexts/GameContext";
import { getDirectionSet } from "@/lib/notation";
import { cn } from "@/lib/utils";
import { CommandIcon } from "@/components/ui/CommandIcon";
import { DirectionChip } from "@/components/ui/direction-chip";
import { PropertyChip } from "@/components/ui/ValueBadge";
import { HitLevelIcon } from "@/components/icons/HitLevelIcon";

/**
 * Renders a Notes string, replacing `:CODE:` tokens with rich components
 * instead of bare SVG images. Same components used elsewhere in the app so
 * a KND chip in the notes column looks identical to a KND chip in the
 * Properties column (same colour, same tooltip, same everything).
 *
 * Routing order per token:
 *
 *   1. directional (active style)  → arrow icon or DirectionChip
 *   2. hit level                   → HitLevelIcon
 *   3. property / outcome tag      → PropertyChip
 *   4. single-letter alphabetic    → CommandIcon (button pill). Lowercase
 *                                    is treated as a slide input.
 *   5. legacy SVG icon             → inline <img> (GC, CE, SC and other
 *                                    game-specific icons without a component
 *                                    equivalent fall through here).
 *   6. none of the above           → the raw `:CODE:` stays as literal text.
 */
const NotesRendererInner: React.FC<{ note: string | null }> = ({ note }) => {
  const {
    availableIcons,
    getIconUrl,
    notationStyle,
    hitLevels,
    getPropertyInfo,
    selectedGame,
  } = useGame();

  const directionSet = useMemo(
    () => getDirectionSet(notationStyle),
    [notationStyle],
  );
  const directionMode = notationStyle?.directionRenderMode ?? "icon";

  const iconByCode = useMemo(() => {
    const map = new Map<string, (typeof availableIcons)[number]>();
    for (const ic of availableIcons) map.set(ic.code, ic);
    return map;
  }, [availableIcons]);

  if (!note) return <>—</>;

  // Match any `:word:` — classification decides what to render and what to
  // leave as literal text.
  const TOKEN_RE = /:([A-Za-z0-9]+):/g;
  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(note))) {
    const start = match.index;
    const end = TOKEN_RE.lastIndex;
    const raw = match[0];
    const code = match[1];

    // Emit preceding literal text (if any).
    if (start > lastIndex) {
      out.push(
        <span key={`text-${key++}`}>{note.slice(lastIndex, start)}</span>,
      );
    }
    lastIndex = end;

    // ---- Classify + render ---------------------------------------------
    let node: React.ReactNode = null;

    if (directionSet.has(code)) {
      if (directionMode === "text") {
        node = <DirectionChip token={code} isHeld={false} />;
      } else {
        node = (
          <img
            src={getIconUrl(code)}
            alt={code}
            className="inline object-contain align-text-bottom h-4 w-4"
          />
        );
      }
    } else if (hitLevels[code.toUpperCase()]) {
      node = <HitLevelIcon level={code} />;
    } else if (getPropertyInfo(code)) {
      node = (
        <PropertyChip
          tag={code}
          info={getPropertyInfo(code)}
          badges={selectedGame.badges}
          sources={{}}
        />
      );
    } else if (/^[A-Za-z]$/.test(code)) {
      // Single-letter alphabetic token → button pill. Lowercase = slide.
      const isSlide = code >= "a" && code <= "z";
      node = <CommandIcon input={code} isHeld={false} isSlide={isSlide} />;
    } else {
      // Fallback: if the token is a known icon code, render the SVG the same
      // way the old renderer did. Game-specific icons like GC / CE / SC land
      // here — they're iconographic and don't map cleanly to one of our
      // typed components.
      const iconCfg = iconByCode.get(code);
      if (iconCfg) {
        node = (
          <img
            src={getIconUrl(code)}
            alt={code}
            title={iconCfg.title || code}
            className={cn(
              "inline object-contain align-text-bottom h-4 w-4 mx-0.5",
              iconCfg.iconClasses,
            )}
          />
        );
      }
    }

    if (node !== null) {
      // React.Fragment wrapper with a stable key so the memo-ed children
      // stay identifiable during virtualised row re-mounts.
      out.push(<React.Fragment key={`tok-${key++}`}>{node}</React.Fragment>);
    } else {
      // Unknown code — preserve the raw `:CODE:` so the authoring stays
      // visible and debuggable instead of silently vanishing.
      out.push(<span key={`raw-${key++}`}>{raw}</span>);
    }
  }

  // Trailing text after the last match.
  if (lastIndex < note.length) {
    out.push(<span key={`text-${key++}`}>{note.slice(lastIndex)}</span>);
  }

  return (
    <span className="inline-flex items-center flex-wrap gap-0.5">{out}</span>
  );
};

export const NotesRenderer = React.memo(NotesRendererInner);
