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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Github, ExternalLink, Database, Code, Users, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreditsModal() {
  const { creditsOpen, setCreditsOpen } = useCommand();
  const { selectedGame, characters, gameCredits, selectedCharacterId, gameCreditsDescription } =
    useGame();
  const [showAll, setShowAll] = React.useState(false);

  React.useEffect(() => {
    if (creditsOpen) {
      setShowAll(selectedCharacterId === null || selectedCharacterId === -1);
    }
  }, [creditsOpen, selectedCharacterId]);

  // Filter characters that have credits
  const charactersWithCredits = React.useMemo(() => {
    let chars = characters.filter((c) => c.credits && c.credits.length > 0);
    if (
      !showAll &&
      selectedCharacterId !== null &&
      selectedCharacterId !== -1
    ) {
      chars = chars.filter((c) => c.id === selectedCharacterId);
    }
    return chars;
  }, [characters, showAll, selectedCharacterId]);

  return (
    <Dialog open={creditsOpen} onOpenChange={setCreditsOpen}>
      <DialogContent
        style={{ backgroundColor: "var(--background)" }}
        className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0 gap-0 top-[30%] translate-y-[-30%]"
      >
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-2xl flex items-center gap-2">
            Credits
          </DialogTitle>
          <DialogDescription>
            Contributors and data sources for {selectedGame.name} and the
            application.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Application Section */}
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Code className="h-5 w-5" /> Application
            </h3>
            <div className="">
              <div className="mb-2 text-sm text-muted-foreground whitespace-pre-wrap">
                Made by Fotten.
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://github.com/Raevhaal/FrameData"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Github className="mr-2 h-4 w-4" /> GitHub
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://twitter.com/FottenSC"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Twitter className="mr-2 h-4 w-4" /> xDotCom
                  </a>
                </Button>
              </div>
            </div>
          </section>

          {/* Game Data Section */}
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database className="h-5 w-5" /> {selectedGame.name} Data
            </h3>

            {gameCreditsDescription && (
              <div className="mb-2 text-sm text-muted-foreground whitespace-pre-wrap">
                {gameCreditsDescription}
              </div>
            )}

            {/* Game Level Credits (Organizer, etc) */}
            {gameCredits && gameCredits.length > 0 && (
              <div className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {gameCredits.map((c, i) => (
                    <Card key={i} className="overflow-hidden">
                      <CardHeader className="p-4 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base font-medium leading-none">
                            {c.name}
                          </CardTitle>
                          {c.url && (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        {c.role && (
                          <CardDescription className="text-xs">
                            {c.role}
                          </CardDescription>
                        )}
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Character Specific Credits */}
            {(charactersWithCredits.length > 0 || !showAll) && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Character Data
                  </h4>
                </div>
                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  style={{ perspective: "1000px" }}
                >
                  {charactersWithCredits.map((char, index) => (
                    <Card
                      key={char.id}
                      className="overflow-hidden animate-character-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <CardHeader className="p-4 space-y-1">
                        <div className="flex items-center gap-2 mb-2 border-b pb-2">
                          <span className="font-semibold text-sm">
                            {char.name}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {char.credits?.map((c, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>{c.name}</span>
                              {c.url && (
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                  {!showAll && (
                    <Card
                      className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors animate-character-in group"
                      onClick={() => setShowAll(true)}
                      style={{
                        animationDelay: `${charactersWithCredits.length * 50}ms`,
                      }}
                    >
                      <CardHeader className="p-4 flex flex-row items-center justify-center h-full min-h-[100px]">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                          <Users className="h-8 w-8 group-hover:scale-110 transition-transform duration-300" />
                          <span className="font-medium">
                            Show All Characters
                          </span>
                        </div>
                      </CardHeader>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {(!gameCredits || gameCredits.length === 0) &&
              charactersWithCredits.length === 0 &&
              showAll && (
                <div className="text-muted-foreground text-sm italic">
                  No specific credits available for this game's data.
                </div>
              )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
