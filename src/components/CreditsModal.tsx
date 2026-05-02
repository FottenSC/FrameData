import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCommand } from "@/contexts/CommandContext";
import { useGame } from "@/contexts/GameContext";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Credits modal.
 *
 * Layout ported from the original SC6 / HorseData app
 * (https://github.com/FottenSC/Sc6-HorseData/blob/main/index.html). The
 * sections mirror the source one-for-one:
 *
 *   1. **Intro** — community links: shared framedata sheet, GitHub repo,
 *      issue tracker, Framecalibur Discord.
 *   2. **Contributors** — flat per-character list ("Character — handle"),
 *      with optional Organizer + per-game extras at the top. The
 *      character credits are populated from `Game.json` so this
 *      automatically follows the active game (SC6 / Tekken8 / future).
 *   3. **Site** — site author + library stack.
 *   4. **Bug reports** — Framecalibur Discord call-out.
 *
 * All collapsible sections use the native `<details>` element instead
 * of a JS-driven Collapse component — accessible by default, no state
 * to wire, and the chevron + animation are handled by CSS.
 */

// SC6-specific community resource. The Tekken side of the project
// doesn't have an equivalent shared sheet, so we conditionally render it.
const SHARED_SHEET_URLS: Record<string, string> = {
  SoulCalibur6:
    "https://docs.google.com/spreadsheets/d/1R3I_LXfqhvFjlHTuj-wSWwwqYmlUf299a3VY9pVyGEw",
};

// Open Framecalibur community Discord — same link the source modal used.
const FRAMECALIBUR_DISCORD = "https://discord.gg/XhnVuFe";

// App / repo links.
const APP_GITHUB = "https://github.com/FottenSC/FrameData";
const APP_ISSUES = "https://github.com/FottenSC/FrameData/issues";
const APP_AUTHOR_TWITTER = "https://twitter.com/FottenSC";

// Static library list. Easier to maintain inline than to derive from
// package.json at runtime — this section reads as marketing copy, not
// machine-generated, and the source modal does the same.
const SITE_LIBRARIES: { name: string; url: string }[] = [
  { name: "React", url: "https://react.dev/" },
  { name: "Vite", url: "https://vitejs.dev/" },
  { name: "TanStack Router", url: "https://tanstack.com/router" },
  { name: "TanStack Query", url: "https://tanstack.com/query" },
  { name: "TanStack Virtual", url: "https://tanstack.com/virtual" },
  { name: "Radix UI", url: "https://www.radix-ui.com/" },
  { name: "Tailwind CSS", url: "https://tailwindcss.com/" },
  { name: "Lucide", url: "https://lucide.dev/" },
  { name: "cmdk", url: "https://cmdk.paco.me/" },
  { name: "Sonner", url: "https://sonner.emilkowal.ski/" },
  { name: "fflate", url: "https://github.com/101arrowz/fflate" },
];

const Link: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = ({
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

export function CreditsModal() {
  const { creditsOpen, setCreditsOpen } = useCommand();
  const {
    selectedGame,
    characters,
    gameCredits,
    gameCreditsDescription,
    isCharactersLoading,
  } = useGame();

  // Drop characters with no contributor info — no point rendering an
  // empty "Character —" line. Sort by name so the list is scan-friendly
  // (and stable across game-data reloads).
  const charactersWithCredits = React.useMemo(
    () =>
      characters
        .filter((c) => c.credits && c.credits.length > 0)
        .toSorted((a, b) => a.name.localeCompare(b.name)),
    [characters],
  );

  const sharedSheetUrl = SHARED_SHEET_URLS[selectedGame.id];
  const dataLoading = isCharactersLoading && characters.length === 0;

  return (
    <Dialog open={creditsOpen} onOpenChange={setCreditsOpen}>
      <DialogContent
        style={{ backgroundColor: "var(--background)" }}
        className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0 gap-0 top-[15%] translate-y-0"
      >
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle className="text-2xl">Credits</DialogTitle>
          <DialogDescription className="sr-only">
            Contributors and site credits for {selectedGame.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm leading-relaxed">
          {/* 1. INTRO — community links */}
          <section className="space-y-1">
            {sharedSheetUrl && (
              <p>
                Link to the shared framedata:{" "}
                <Link href={sharedSheetUrl}>Shared framedata</Link>
              </p>
            )}
            <p>
              Site is open source: <Link href={APP_GITHUB}>GitHub repo</Link>
            </p>
            <p>
              Submit bugs to: <Link href={APP_ISSUES}>Issue tracker</Link>
            </p>
            <p>
              Or reach out:{" "}
              <Link href={APP_AUTHOR_TWITTER}>@FottenSC on x.com</Link>
            </p>
          </section>

          {/* 2. CONTRIBUTORS */}
          <section>
            <h3 className="font-semibold mb-2">
              Thanks to everyone who contributed framedata:
            </h3>

            {gameCreditsDescription && (
              <p className="mb-2 text-muted-foreground whitespace-pre-wrap">
                {gameCreditsDescription}
              </p>
            )}

            {/*
              Cold-open skeleton. The modal can be triggered before
              Game.json finishes loading (e.g. from the command palette
              right after a game switch). Render compact skeleton lines
              that look roughly like the real "Character — handle" rows.
            */}
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

          {/* 3. SITE — author + libraries */}
          <section>
            <h3 className="font-semibold mb-2">Site</h3>
            <p className="mb-1">
              Site by <Link href={APP_AUTHOR_TWITTER}>@FottenSC</Link>{" "}
              (<Link href={APP_GITHUB}>source</Link>).
            </p>
            <p className="mb-1">
              Originally based on the SC6 / HorseData framedata app — credit to{" "}
              <Link href="https://github.com/aHorseface/Sc6-HorseData">
                @Horseface
              </Link>{" "}
              for the original UI design.
            </p>
            <details className="group mt-2">
              <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors marker:hidden list-none flex items-center gap-1">
                <span className="inline-block transition-transform group-open:rotate-90">
                  ▸
                </span>
                <span>Libraries</span>
              </summary>
              <ul className="mt-1 ml-4 space-y-0.5">
                {SITE_LIBRARIES.map((lib) => (
                  <li key={lib.name}>
                    <Link href={lib.url}>{lib.name}</Link>
                  </li>
                ))}
              </ul>
            </details>
          </section>

          {/* 4. BUG REPORTS — Framecalibur */}
          <section>
            <h3 className="font-semibold mb-1">
              Framedata errors can be reported to Framecalibur:
            </h3>
            <p className="text-muted-foreground">
              Problems with the site itself should go to the{" "}
              <Link href={APP_ISSUES}>issue tracker</Link>.
            </p>
            <p>
              <Link href={FRAMECALIBUR_DISCORD}>Framecalibur Discord</Link>
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- helpers ----------

interface CreditListProps {
  gameLevel: ReturnType<typeof useGame>["gameCredits"];
  characters: ReturnType<typeof useGame>["characters"];
}

/**
 * The contributor list is two-tiered:
 *
 *   - **Game-level**: one line per `gameCredits` entry — used for
 *     overall organiser / spreadsheet curator credit ("Organizer:
 *     @unicorn_cz").
 *   - **Per character**: "Character — handle1 & handle2".
 *
 * The full list can run to ~30 lines on SC6, so we wrap the per-character
 * portion in a `<details>` that defaults open but can be collapsed.
 */
const CreditList: React.FC<CreditListProps> = ({ gameLevel, characters }) => {
  const empty = gameLevel.length === 0 && characters.length === 0;

  if (empty) {
    return (
      <p className="italic text-muted-foreground">
        No specific credits available for this game's data yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {gameLevel.length > 0 && (
        <ul className="space-y-1">
          {gameLevel.map((c, i) => (
            <li key={i}>
              <span className="text-muted-foreground">{c.role ?? "Credit"}</span>
              {": "}
              {c.url ? <Link href={c.url}>{c.name}</Link> : c.name}
            </li>
          ))}
        </ul>
      )}

      {characters.length > 0 && (
        <details open className="group">
          <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors marker:hidden list-none flex items-center gap-1 mb-1">
            <span className="inline-block transition-transform group-open:rotate-90">
              ▸
            </span>
            <span>Per character</span>
          </summary>
          <ul className="space-y-0.5 ml-4">
            {characters.map((char) => (
              <li key={char.id}>
                <span className="font-medium">{char.name}</span>
                <span className="text-muted-foreground"> — </span>
                {char.credits!.map((c, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && (
                      <span className="text-muted-foreground"> &amp; </span>
                    )}
                    {c.url ? <Link href={c.url}>{c.name}</Link> : c.name}
                  </React.Fragment>
                ))}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
