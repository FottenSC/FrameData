import React from "react";
import { useGame } from "@/contexts/GameContext";
import { cn } from "@/lib/utils";

export const NotesRenderer: React.FC<{ note: string | null }> = ({ note }) => {
  const { availableIcons, getIconUrl } = useGame();

  if (!note) return <>—</>;

  const parts: React.ReactNode[] = [];
  const codes = availableIcons.map((ic) => ic.code).join("|");
  const regex = new RegExp(`:(${codes}):`, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;
  while ((match = regex.exec(note))) {
    const start = match.index;
    const iconName = match[1];
    if (start > lastIndex) {
      parts.push(<span key={`text-${partIndex}`}>{note.slice(lastIndex, start)}</span>);
      partIndex++;
    }
    const iconConfig = availableIcons.find((ic) => ic.code === iconName);
    if (iconConfig) {
      const titleText = iconConfig.title || iconName.toUpperCase();
      const classes = cn("inline object-contain align-text-bottom h-4 w-4", iconConfig.iconClasses);
      parts.push(<img key={`${iconName}-${start}`} src={getIconUrl(iconName)} alt={iconName} title={titleText} className={cn(classes, "mx-0.5")} />);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < note.length) {
    parts.push(<span key={`text-${partIndex}`}>{note.slice(lastIndex)}</span>);
  }
  return <>{parts}</>;
};
