import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame, AVAILABLE_GAMES } from '../contexts/GameContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Gamepad2, Sword } from 'lucide-react'; // Example icons

// Game-specific icons (adjust as needed)
const gameIcons: Record<string, React.ReactNode> = {
  soulcalibur6: <Sword className="h-5 w-5 mr-2" />,
  tekken8: <Gamepad2 className="h-5 w-5 mr-2" />, // Add Tekken 8 icon if desired
};

export const GameSelectionPage: React.FC = () => {
  const { setSelectedGameById } = useGame();
  const navigate = useNavigate();

  const handleGameSelect = (gameId: string) => {
    setSelectedGameById(gameId);
    // Navigation is now handled by the context's setSelectedGameById method
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Select a Game</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {AVAILABLE_GAMES.map((game) => (
          <Card 
            key={game.id} 
            className="hover:shadow-lg transition-shadow duration-200 cursor-pointer flex flex-col"
            onClick={() => handleGameSelect(game.id)}
          >
            <CardHeader className="flex-grow">
              <CardTitle className="flex items-center justify-center text-xl">
                {gameIcons[game.id] || <Gamepad2 className="h-5 w-5 mr-2 opacity-70" />} 
                {game.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center mt-auto pt-4">
               {/* Optionally add more game info here */}
               <Button variant="outline" size="sm">Select</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}; 