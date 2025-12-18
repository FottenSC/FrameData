import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame, Character } from "../contexts/GameContext";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const CharacterSelectionPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const {
    selectedGame,
    characters,
    setSelectedCharacterId,
    isCharactersLoading,
    characterError,
  } = useGame();
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = React.useState(false);
  const [exitId, setExitId] = React.useState<number | null>(null);

  const handleCharacterSelect = (characterId: number) => {
    const character = characters.find((c) => c.id === characterId);
    if (character && selectedGame) {
      setExitId(characterId);
      setIsExiting(true);
      setTimeout(() => {
        setSelectedCharacterId(characterId);
        navigate(`/${selectedGame.id}/${encodeURIComponent(character.name)}`);
      }, 300);
    } else {
      console.error("Selected character or game not found during navigation");
      navigate("/games");
    }
  };

  const handleAllSelect = () => {
    if (selectedGame) {
      setExitId(-1);
      setIsExiting(true);
      setTimeout(() => {
        setSelectedCharacterId(-1);
        navigate(`/${selectedGame.id}/All`);
      }, 300);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-extrabold mb-8 text-center animate-character-in tracking-tight">
        Select Character for {selectedGame?.name || "Game"}
      </h1>

      {/* Loading State */}
      {isCharactersLoading && (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Loading characters...
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {characterError && !isCharactersLoading && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">
              Error Loading Characters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive/90">{characterError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/games")}
              className="mt-4"
            >
              Back to Game Selection
            </Button>
          </CardContent>
        </Card>
      )}

      {!isCharactersLoading &&
        !characterError &&
        selectedGame &&
        characters.length > 0 && (
          <div
            className={cn(
              "character-grid-container grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-3 min-h-[40vh]",
              isExiting ? "pointer-events-none" : "animate-fadeIn",
            )}
          >
            {/* All Characters option */}
            <Card
              className={cn(
                "group cursor-pointer flex flex-col items-center overflow-hidden hover:shadow-md hover:border-primary/50 transition-all duration-300 border-muted bg-card animate-character-in",
                isExiting && exitId === -1 && "scale-110 opacity-0 z-10",
                isExiting && exitId !== -1 && "opacity-20 scale-95",
              )}
              style={{ animationDelay: "0ms" }}
              onClick={handleAllSelect}
            >
              <div className="relative w-full aspect-square bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors">
                <span className="text-4xl text-muted-foreground group-hover:scale-110 transition-transform duration-300">
                  👥
                </span>
              </div>
              <div className="w-full p-2 bg-card border-t border-border/50">
                <p className="text-xs sm:text-sm font-bold text-center text-card-foreground truncate group-hover:text-primary transition-all">
                  All Characters
                </p>
              </div>
            </Card>

            {characters.map((character, index) => (
              <Card
                key={character.id}
                className={cn(
                  "group cursor-pointer flex flex-col items-center overflow-hidden hover:shadow-md hover:border-primary/50 transition-all duration-300 border-muted bg-card animate-character-in",
                  isExiting && exitId === character.id && "scale-110 opacity-0 z-10",
                  isExiting && exitId !== character.id && "opacity-20 scale-95",
                )}
                style={{ animationDelay: `${(index + 1) * 15}ms` }}
                onClick={() => handleCharacterSelect(character.id)}
              >
                <div className="relative w-full aspect-square overflow-hidden bg-muted">
                  {character.image ? (
                    <img
                      src={character.image}
                      alt={character.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted/50">
                      <span className="text-muted-foreground text-xs">
                        No Image
                      </span>
                    </div>
                  )}
                </div>
                <div className="w-full p-2 bg-card border-t border-border/50">
                  <p className="text-xs sm:text-sm font-bold text-center text-card-foreground truncate group-hover:text-primary transition-all">
                    {character.name}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}

      {/* No Characters Found State */}
      {!isCharactersLoading &&
        !characterError &&
        selectedGame &&
        characters.length === 0 && (
          <div className="text-center text-muted-foreground mt-8 min-h-[40vh] flex flex-col items-center justify-center">
            <p>No characters found for {selectedGame.name}.</p>
            <Button
              variant="link"
              onClick={() => navigate("/games")}
              className="mt-2"
            >
              Back to Game Selection
            </Button>
          </div>
        )}
    </div>
  );
};
