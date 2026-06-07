import React from "react";
import {
  ExternalLink,
  FileSpreadsheet,
  MessagesSquare,
  Github,
  Bug,
  Twitter,
  Users,
  Link2,
} from "lucide-react";
import { useGame } from "@/contexts/GameContext";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Credits content (no modal wrapper).
 *
 * Two sections:
 *   1. **Contributors** — Organizer + per-character handles, sourced
 *      from `Game.json` via `useGame()`. Auto-follows the active game.
 *   2. **Resources** — community + app links. Per-game entries (shared
 *      spreadsheet, community discord) come from
 *      `Game.json#community`; app-wide entries (GitHub source, issue
 *      tracker, author contact) are constants below.
 *
 * Per-game data lives in Game.json so each fighter's spreadsheet /
 * discord lives next to its own data — no per-game branches in
 * component code.
 */

// App-wide links (apply to all games).
const APP_GITHUB = "https://github.com/FottenSC/FrameData";
const APP_ISSUES = "https://github.com/FottenSC/FrameData/issues";
const APP_AUTHOR_TWITTER = "https://twitter.com/FottenSC";

interface ResourceProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  href: string;
}

/**
 * Visual link tile used by the Resources section. A tinted card with
 * an icon on the left, label + optional description in the middle, and
 * a small ExternalLink hint on the right.
 */
const Resource: React.FC<ResourceProps> = ({
  icon,
  label,
  description,
  href,
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="group flex items-center gap-3 px-3 py-2 rounded-md border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-border transition-colors"
  >
    <span className="shrink-0 grid place-items-center w-9 h-9 rounded-md bg-background text-foreground/70 group-hover:text-foreground border border-border/50 transition-colors">
      {icon}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-medium leading-tight">{label}</span>
      {description && (
        <span className="block mt-0.5 text-[12px] text-muted-foreground leading-tight">
          {description}
        </span>
      )}
    </span>
    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-foreground/80 transition-colors shrink-0" />
  </a>
);

const InlineLink: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = ({
  className,
  children,
  ...rest
}) => (
  <a
    target="_blank"
    rel="noopener noreferrer"
    className={
      "text-primary underline-offset-2 hover:underline " + (className ?? "")
    }
    {...rest}
  >
    {children}
  </a>
);

export const CreditsContent: React.FC = () => {
  const {
    characters,
    gameCredits,
    gameCreditsDescription,
    gameCommunity,
    isCharactersLoading,
  } = useGame();

  const charactersWithCredits = React.useMemo(
    () =>
      characters
        .filter((c) => c.credits && c.credits.length > 0)
        .toSorted((a, b) => a.name.localeCompare(b.name)),
    [characters],
  );

  const dataLoading = isCharactersLoading && characters.length === 0;

  return (
    <div className="space-y-6 px-3 py-3">
      {/* CONTRIBUTORS */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>Contributors</span>
        </h3>

        {gameCreditsDescription && (
          <p className="mb-3 text-[13px] text-muted-foreground whitespace-pre-wrap">
            {gameCreditsDescription}
          </p>
        )}

        {dataLoading ? (
          <ul className="space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="flex items-center gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-28" />
              </li>
            ))}
          </ul>
        ) : (
          <CreditList
            gameLevel={gameCredits}
            characters={charactersWithCredits}
          />
        )}
      </section>

      {/* RESOURCES */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span>Resources</span>
        </h3>

        <div className="space-y-1.5">
          {gameCommunity.dataSheet && (
            <Resource
              icon={<FileSpreadsheet className="h-4 w-4" />}
              label={gameCommunity.dataSheet.label}
              description={gameCommunity.dataSheet.description}
              href={gameCommunity.dataSheet.url}
            />
          )}
          {gameCommunity.discord && (
            <Resource
              icon={<MessagesSquare className="h-4 w-4" />}
              label={gameCommunity.discord.label}
              description={gameCommunity.discord.description}
              href={gameCommunity.discord.url}
            />
          )}
          <Resource
            icon={<Github className="h-4 w-4" />}
            label="Source on GitHub"
            description="Open-source frontend for this site"
            href={APP_GITHUB}
          />
          <Resource
            icon={<Bug className="h-4 w-4" />}
            label="Site bug tracker"
            description="Report issues with the site itself"
            href={APP_ISSUES}
          />
          <Resource
            icon={<Twitter className="h-4 w-4" />}
            label="@FottenSC"
            description="Site author"
            href={APP_AUTHOR_TWITTER}
          />
        </div>
      </section>
    </div>
  );
};

// ---------- helpers ----------

interface CreditListProps {
  gameLevel: ReturnType<typeof useGame>["gameCredits"];
  characters: ReturnType<typeof useGame>["characters"];
}

const CHARACTER_PREVIEW_COUNT = 3;

/**
 * Two-tier list:
 *   - Game-level entries first ("Organizer: @unicorn_cz", …).
 *   - Per-character entries: shows the first few characters as a
 *     teaser; the rest reveal under a "Show all <N>" button. Each
 *     character is its own row in a bordered list with the name on
 *     the left and the contributor handles on the right — easier to
 *     scan than the previous flowing 2-column grid.
 */
const CreditList: React.FC<CreditListProps> = ({ gameLevel, characters }) => {
  const empty = gameLevel.length === 0 && characters.length === 0;
  const [showAll, setShowAll] = React.useState(false);

  if (empty) {
    return (
      <p className="italic text-[13px] text-muted-foreground">
        No specific credits available for this game's data yet.
      </p>
    );
  }

  const totalChars = characters.length;
  const overflowCount = Math.max(0, totalChars - CHARACTER_PREVIEW_COUNT);
  const visible =
    showAll || overflowCount === 0
      ? characters
      : characters.slice(0, CHARACTER_PREVIEW_COUNT);

  return (
    <div className="space-y-3">
      {gameLevel.length > 0 && (
        <ul className="space-y-1 text-[13px]">
          {gameLevel.map((c, i) => (
            <li key={i} className="flex items-baseline gap-2">
              <span className="text-muted-foreground">
                {c.role ?? "Credit"}:
              </span>
              {c.url ? (
                <InlineLink href={c.url}>{c.name}</InlineLink>
              ) : (
                <span>{c.name}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {totalChars > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Per character
              <span className="ml-1.5 text-muted-foreground/70 normal-case tracking-normal">
                ({totalChars})
              </span>
            </h4>
          </div>

          <ul className="divide-y divide-border/40 rounded-md border border-border/50 overflow-hidden">
            {visible.map((char) => (
              <li
                key={char.id}
                className="flex items-baseline gap-3 px-3 py-2 text-[13px] hover:bg-muted/20 transition-colors"
              >
                <span className="font-medium text-foreground min-w-[90px] shrink-0">
                  {char.name}
                </span>
                <span className="flex-1 min-w-0 leading-snug">
                  {char.credits!.map((c, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <span className="text-muted-foreground"> &amp; </span>
                      )}
                      {c.url ? (
                        <InlineLink href={c.url}>{c.name}</InlineLink>
                      ) : (
                        <span>{c.name}</span>
                      )}
                    </React.Fragment>
                  ))}
                </span>
              </li>
            ))}
          </ul>

          {overflowCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="text-[12px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors focus-visible:outline-none focus-visible:underline"
            >
              {showAll
                ? "Show less"
                : `Show all ${totalChars} characters (+${overflowCount} more)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
