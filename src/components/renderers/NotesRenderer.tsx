import React from "react";
import { useGame } from "@/contexts/GameContext";
import { cn } from "@/lib/utils";

const NotesRendererInner: React.FC<{ note: string | null }> = ({ note }) => {
  const { availableIcons, getIconUrl } = useGame();

  const regex = React.useMemo(() => {
    const codes = availableIcons.map((ic) => ic.code).join("|");
    if (!codes) return null;
    return new RegExp(`:(${codes}):`, "g");
  }, [availableIcons]);

  const parts = (() => {
    if (!note || !regex) return null;

    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let partIndex = 0;
    
    // Reset regex lastIndex because it's global
    regex.lastIndex = 0;
    
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
      result.push(
        <span key={`text-${partIndex}`}>{note.slice(lastIndex)}</span>,
      );
    }
    return result;
  })();

  if (!note) return <>—</>;
  return <>{parts}</>;
};

export const NotesRenderer = React.memo(NotesRendererInner);
