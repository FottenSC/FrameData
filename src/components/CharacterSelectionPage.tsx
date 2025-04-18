import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export const CharacterSelectionPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { selectedGame, characters, setSelectedCharacterId } = useGame();
  const navigate = useNavigate();

  // TODO: Fetch characters if not already loaded in context?
  //       This might happen if the user lands directly on this page.

  const handleCharacterSelect = (characterId: number) => {
    const character = characters.find(c => c.id === characterId);
    if (character && selectedGame) {
      setSelectedCharacterId(characterId); // Update context
      navigate(`/${selectedGame.id}/${encodeURIComponent(character.name)}`); // Navigate to frame data
    } else {
      console.error("Selected character or game not found");
      // Handle error, maybe navigate back to game selection?
      navigate('/games');
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Select Character for {selectedGame?.name || 'Game'}</h1>
      {/* Basic loading/error handling - enhance as needed */}
      {!selectedGame && <p>Loading game...</p>}
      {selectedGame && characters.length === 0 && <p>Loading characters...</p>}
      {selectedGame && characters.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {characters.map((character) => (
            <Card
              key={character.id}
              className="hover:shadow-lg transition-shadow duration-200 cursor-pointer flex flex-col items-center p-4"
              onClick={() => handleCharacterSelect(character.id)}
            >
              <CardHeader className="p-0 mb-2">
                 {/* TODO: Add character image/icon? */}
                <CardTitle className="text-lg text-center">{character.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-auto">
                <Button variant="outline" size="sm">Select</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}; 