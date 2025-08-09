import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame, Character } from '../contexts/GameContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Loader2 } from 'lucide-react';

export const CharacterSelectionPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { 
    selectedGame, 
    characters, 
    setSelectedCharacterId, 
    isCharactersLoading, 
    characterError 
  } = useGame();
  const navigate = useNavigate();

  const handleCharacterSelect = (characterId: number) => {
    const character = characters.find(c => c.id === characterId);
    if (character && selectedGame) {
      setSelectedCharacterId(characterId);
      navigate(`/${selectedGame.id}/${encodeURIComponent(character.name)}`);
    } else {
      console.error("Selected character or game not found during navigation");
      navigate('/games');
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Select Character for {selectedGame?.name || 'Game'}</h1>
      
      {/* Loading State */}
      {isCharactersLoading && (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading characters...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {characterError && !isCharactersLoading && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Characters</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive/90">{characterError}</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/games')} className="mt-4">
              Back to Game Selection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Character List - Only show if not loading and no error */}
      {!isCharactersLoading && !characterError && selectedGame && characters.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fadeIn min-h-[40vh]">
          {/* All Characters option */}
          <Card
            key="all-characters"
            className="hover:shadow-lg transition-shadow duration-200 cursor-pointer flex flex-col items-center p-4 text-center border-primary/40"
            onClick={() => {
              if (selectedGame) {
                setSelectedCharacterId(-1);
                navigate(`/${selectedGame.id}/All`);
              }
            }}
          >
            <CardHeader className="p-0 mb-2 flex-grow flex items-center justify-center">
              <CardTitle className="text-lg">All Characters</CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-auto">
              <Button variant="outline" size="sm">View All</Button>
            </CardContent>
          </Card>

          {characters.map((character) => (
            <Card
              key={character.id}
              className="hover:shadow-lg transition-shadow duration-200 cursor-pointer flex flex-col items-center p-4 text-center"
              onClick={() => handleCharacterSelect(character.id)}
            >
              <CardHeader className="p-0 mb-2 flex-grow flex items-center justify-center">
                <CardTitle className="text-lg">{character.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-auto">
                <Button variant="outline" size="sm">Select</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* No Characters Found State */}
      {!isCharactersLoading && !characterError && selectedGame && characters.length === 0 && (
         <div className="text-center text-muted-foreground mt-8 min-h-[40vh] flex flex-col items-center justify-center">
            <p>No characters found for {selectedGame.name}.</p>
             <Button variant="link" onClick={() => navigate('/games')} className="mt-2">
              Back to Game Selection
            </Button>
          </div>
      )}
    </div>
  );
}; 