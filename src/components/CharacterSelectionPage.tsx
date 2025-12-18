import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame, Character } from "../contexts/GameContext";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Loader2 } from "lucide-react";

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

  const handleCharacterSelect = (characterId: number) => {
    const character = characters.find((c) => c.id === characterId);
    if (character && selectedGame) {
      setSelectedCharacterId(characterId);
      navigate(`/${selectedGame.id}/${encodeURIComponent(character.name)}`);
    } else {
      console.error("Selected character or game not found during navigation");
      navigate("/games");
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">
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
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-3 animate-fadeIn min-h-[40vh]">
            {/* All Characters option */}
            {/* All Characters option */}
            <Card
              className="group cursor-pointer flex flex-col items-center overflow-hidden hover:shadow-md hover:border-primary/50 transition-all duration-300 border-muted bg-card"
              onClick={() => {
                if (selectedGame) {
                  setSelectedCharacterId(-1);
                  navigate(`/${selectedGame.id}/All`);
                }
              }}
            >
              <div className="relative w-full aspect-square bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors">
                <span className="text-4xl text-muted-foreground group-hover:scale-110 transition-transform duration-300">
                  👥
                </span>
              </div>
              <div className="w-full p-2 bg-card border-t border-border/50">
                <p className="text-xs sm:text-sm font-medium text-center text-card-foreground truncate group-hover:text-primary transition-colors">
                  All Characters
                </p>
              </div>
            </Card>

            {characters.map((character) => (
              <Card
                key={character.id}
                className="group cursor-pointer flex flex-col items-center overflow-hidden hover:shadow-md hover:border-primary/50 transition-all duration-300 border-muted bg-card"
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
                  <p className="text-xs sm:text-sm font-medium text-center text-card-foreground truncate group-hover:text-primary transition-colors">
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
