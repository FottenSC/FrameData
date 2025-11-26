import React, { memo, useMemo } from "react";
import { useGame } from "@/contexts/GameContext";
import { cn } from "@/lib/utils";

const NotesRendererInner: React.FC<{ note: string | null }> = ({ note }) => {
  const { availableIcons, getIconUrl } = useGame();

  const parts = useMemo(() => {
    if (!note) return null;

    const result: React.ReactNode[] = [];
    const codes = availableIcons.map((ic) => ic.code).join("|");
    const regex = new RegExp(`:(${codes}):`, "g");
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let partIndex = 0;
    while ((match = regex.exec(note))) {
      const start = match.index;
      const iconName = match[1];
      if (start > lastIndex) {
        result.push(
          <span key={`text-${partIndex}`}>{note.slice(lastIndex, start)}</span>,
        );
        partIndex++;
      }
      const iconConfig = availableIcons.find((ic) => ic.code === iconName);
      if (iconConfig) {
        const titleText = iconConfig.title || iconName.toUpperCase();
        const classes = cn(
          "inline object-contain align-text-bottom h-4 w-4",
          iconConfig.iconClasses,
        );
        result.push(
          <img
            key={`${iconName}-${start}`}
            src={getIconUrl(iconName)}
            alt={iconName}
            title={titleText}
            className={cn(classes, "mx-0.5")}
          />,
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < note.length) {
      result.push(<span key={`text-${partIndex}`}>{note.slice(lastIndex)}</span>);
    }
    return result;
  }, [note, availableIcons, getIconUrl]);

  if (!note) return <>—</>;
  return <>{parts}</>;
};

// Memoize to prevent re-renders during table virtualization transitions
export const NotesRenderer = memo(NotesRendererInner);
