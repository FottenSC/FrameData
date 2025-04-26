import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import { initializeDatabase } from '../utils/initializeDatabase';
import { Loader2, Shield, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useGame, Character, AVAILABLE_GAMES, IconConfig } from '../contexts/GameContext';
import { cn } from "@/lib/utils";
import { FilterBuilder, ActiveFiltersBadge, FilterCondition } from './FilterBuilder';

// Using the SQL.js loaded via CDN
declare global {
  interface Window {
    initSqlJs: () => Promise<any>;
  }
}

// Updated Move interface based on schema.sql and component usage
interface Move {
  ID: number;
  Command: string; // This will store the *translated* command
  Stance: string | null;
  HitLevel: string | null; // From schema (TEXT)
  Impact: number; // From schema (REAL)
  Damage: string | null; // Original string representation
  DamageDec: number | null; // Decimal representation for display
  Block: number | null; // For badge rendering, mapped from BlockDec
  HitString: string | null; // Original Hit text
  Hit: number | null; // For badge rendering, mapped from HitDec
  CounterHitString: string | null; // Original Counter Hit text
  CounterHit: number | null; // For badge rendering, mapped from CounterHitDeci
  GuardBurst: number | null; // From schema (INTEGER)
  Notes: string | null; // From schema
}

// Define sortable columns (using Move interface keys for type safety)
type SortableColumn = keyof Move | 'Damage' | 'Hit' | 'CounterHit' | 'OriginalCommand'; // Allow specific strings if needed for clarity/mapping

// --- Translation Layer ---
type TranslationMap = Record<string, string>;

const soulCaliburButtonMappings: TranslationMap = {
    ':(B+C):': ':(B+K):',
    ':(B+D):': ':(B+G):',
    ':(C+D):': ':(K+G):',
    ':A+B+C:': ':A+B+K:',
    ':A+D:': ':A+G:',
    ':A+C:': ':A+K:',
    ':B+C:': ':B+K:',
    ':B+D:': ':B+G:',
    ':C+D:': ':K+G:',
    '(C)': '(K)',
    ':C:': ':K:',
    ':c:': ':k:',
    '(D)': '(G)',
    ':D:': ':G:',
    ':d:': ':g:',
};

// Potentially add other reusable sets like:
const tekkenButtonMappings: TranslationMap = {
    ':2::3::6:': ':qcf:',     // Quarter Circle Forward
    ':2::1::4:': ':qcb:',     // Quarter Circle Back
    ':6::2::3:': ':dp:',      // Dragon Punch motion
    ':4::1::2::3::6:': ':hcf:',   // Half Circle Forward
    ':6::3::2::1::4:': ':hcb:',   // Half Circle Back

    // Buttons
    ':1:': ':LP:', // Left Punch
    '2': 'RP', // Right Punch
    '3': 'LK', // Left Kick
    '4': 'RK', // Right Kick
    '1+2': 'LP+RP',
    '3+4': 'LK+RK',
};

// Define which maps each game uses, plus game-specific additions
type GameMappingConfig = {
  extends?: string[]; // List of module names to inherit from
  specific?: TranslationMap; // Game-unique mappings
};

const gameMappingConfigurations: Record<string, GameMappingConfig> = {
  'SoulCalibur6': {
    extends: ['soulCaliburButtons'], // Use these modules - removed numpadMotions
    specific: {}
  },
  // Example for another game:
  'Tekken8': {
    extends: ['tekkenButtonMappings'], // Use Tekken buttons - removed numpadMotions
    specific: {} 
  },
  'default': { // Fallback configuration
    extends: [],
    specific: {}
  }
};

// Helper map to access modules by name
const availableMappingModules: Record<string, TranslationMap> = {
  soulCaliburButtons: soulCaliburButtonMappings,
  tekkenButtonMappings: tekkenButtonMappings,
};

// Helper function to build the final map for a game
const getEffectiveTranslationMap = (gameId: string): TranslationMap => {
  const config = gameMappingConfigurations[gameId] ?? gameMappingConfigurations.default;
  let effectiveMap: TranslationMap = {};

  // Add mappings from extended modules
  if (config.extends) {
    config.extends.forEach(moduleName => {
      const moduleMap = availableMappingModules[moduleName];
      if (moduleMap) {
        effectiveMap = { ...effectiveMap, ...moduleMap };
      }
    });
  }

  // Add/override with game-specific mappings
  if (config.specific) {
    effectiveMap = { ...effectiveMap, ...config.specific };
  }

  return effectiveMap;
};

// Helper function to apply translations (Revised replacement logic)
const translateString = (text: string | null, map: TranslationMap): string | null => {
  if (text === null) {
    return null;
  }
  let translatedText = text;
  // Sort keys by length descending to replace longer sequences first (e.g., ':A+B+C:' before ':C:').
  const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    // Escape the key for use in a regex
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Create a global regex for the exact key string
    const regex = new RegExp(escapedKey, 'g');
    // Replace all global occurrences of the exact key
    translatedText = translatedText.replace(regex, map[key]);
  }

  // Debug check for remaining 'C' or 'D'
  /* if (translatedText && (translatedText.includes('C') || translatedText.includes('D'))) {
    // Consider if this check should be game-specific, e.g., only for SoulCalibur
    console.log(`Potential translation issue: Translated text still contains 'C' or 'D'. Original: "${text}", Translated: "${translatedText}"`);
  } */


  return translatedText;
};
// --- End Translation Layer ---

// --- Helper Functions (Moved outside component) ---

// Helper to get tooltip text for icons (can be expanded for i18n)
const getIconTooltip = (iconCode: string, availableIcons: IconConfig[]): string => {
  const directionTooltips: Record<string, string> = {
    '1': 'Down+Back',
    '2': 'Down',
    '3': 'Down+Forward',
    '4': 'Back',
    '5': 'Neutral',
    '6': 'Forward',
    '7': 'Up+Back',
    '8': 'Up',
    '9': 'Up+Forward',
  };

  const upperCode = iconCode.toUpperCase();

  // Check directional tooltips first
  if (directionTooltips[upperCode]) {
    return directionTooltips[upperCode];
  }

  // Then, try to find the icon in the context for game-specific tooltips
  const iconConfig = availableIcons.find(icon => icon.code.toUpperCase() === upperCode);
  if (iconConfig && iconConfig.title) {
    return iconConfig.title;
  }

  // Fallback to the code itself if no tooltip is found
  return upperCode;
};

// Combined badge rendering function (Moved outside component)
const renderBadge = (value: number | null, text: string | null, forceNoSign: boolean = false): React.ReactNode => {
  // Determine display text: Use text if available, otherwise format value, fallback to '—'
  let displayText: string;
  if (text !== null && text !== undefined) {
    displayText = text;
  } else if (value !== null && value !== undefined) {
    // Only add '+' if value > 0 AND forceNoSign is false
    displayText = (!forceNoSign && value > 0 ? '+' : '') + value; 
  } else {
    displayText = '—';
  }

  // Check for special strings first
  if (text === 'KND') {
    return <Badge className="bg-fuchsia-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
  }
  if (text === 'STN') {
    return <Badge className="bg-pink-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
  }
  if (text === 'LNC') {
    return <Badge className="bg-rose-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
  }

  // Fallback to frame advantage logic based on the numeric value
  if (value === null || value === undefined) {
    // Use neutral Tailwind classes for unknown/null state
    return <Badge className="bg-gray-500 hover:bg-gray-600 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>; 
  }

  // Use Tailwind classes based on numeric value
  if (value >= 0) { // Includes 0
    return <Badge className="bg-green-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
  } else { // value < 0
    return <Badge className="bg-rose-700 text-white w-12 inline-flex items-center justify-center">{displayText}</Badge>;
  }
};

// --- End Helper Functions ---

// --- Standalone UI Components (Moved outside main component) ---

// Define a self-contained hit level icon component
const HitLevelIcon = React.memo(({ level }: { level: string }) => {
  let bgColor = 'bg-gray-400';
  let textColor = 'text-white';

  switch (level.toUpperCase()) {
    case 'M': bgColor = 'bg-yellow-500'; break;
    case 'L': bgColor = 'bg-cyan-500'; break;
    case 'H': bgColor = 'bg-pink-500'; break;
    case 'SM': bgColor = 'bg-purple-500'; break;
    case 'SL': bgColor = 'bg-cyan-500'; break; 
    case 'SH': bgColor = 'bg-orange-500'; break;
    default:
      // Unknown hit level, no debug logging
      break;
  }

  return (
    <div
      className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center p-px ring-1 ring-black"
      title={level}
    >
      <div className="w-full h-full rounded-full bg-white flex items-center justify-center p-px">
        <div className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold ${bgColor} ${textColor}`}>
          {level.length > 1 && ['SL', 'SH', 'SM'].includes(level.toUpperCase()) 
            ? level.toUpperCase() 
            : level.charAt(0).toUpperCase()} 
        </div>
      </div>
    </div>
  );
});

// Define a self-contained component for expandable hit levels
const ExpandableHitLevels = React.memo(({ 
  hitLevelString, 
  maxIconsToShow = 3 // Default remains 3 for the 5+ case
}: { 
  hitLevelString: string | null, 
  maxIconsToShow?: number 
}) => {
  // Local state for this specific instance
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  // Parse hit levels
  const levels = React.useMemo(() => {
    if (!hitLevelString) return [];
    return hitLevelString.split(/:+/).map(level => level.trim()).filter(Boolean);
  }, [hitLevelString]);
  
  // --- Updated Expansion Logic ---
  // Expand only if there are more levels than maxIconsToShow + 1
  const canExpand = levels.length > maxIconsToShow + 1;
  
  // Handle toggle expansion
  const handleToggle = React.useCallback(() => {
    if (!canExpand) return;
    setIsExpanded(prev => !prev);
  }, [canExpand]);
  
  // If no levels, show placeholder
  if (levels.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  
  // Determine how many icons to show based on expanded state and total count
  let iconsToShow: number;
  if (levels.length <= maxIconsToShow + 1) {
    // Show all icons if the count is within the threshold (maxIconsToShow + 1)
    iconsToShow = levels.length;
  } else {
    // If more than the threshold, show maxIconsToShow initially, or all if expanded
    iconsToShow = isExpanded ? levels.length : maxIconsToShow;
  }
  
  // Show ellipsis only when it can expand and is not expanded
  const showEllipsis = canExpand && !isExpanded;
  // --- End Updated Expansion Logic ---
  
  return (
    <div 
      className={`flex flex-wrap items-center gap-1 ${canExpand ? 'cursor-pointer' : ''}`}
      onClick={canExpand ? handleToggle : undefined}
    >
      {levels.slice(0, iconsToShow).map((level, index) => (
        <div key={`level-${index}`}>
          <HitLevelIcon level={level} />
        </div>
      ))}
      
      {showEllipsis && (
        <ChevronRight size={16} className="text-muted-foreground ml-1" />
      )}
    </div>
  );
});

// Define a self-contained button icon component
const ButtonIcon = React.memo(({ code, isHeld, isSlide }: { 
  code: string, 
  isHeld: boolean, 
  isSlide: boolean 
}) => {
  const letter = code.toUpperCase();
  
  // Base styles
  let baseClasses = "border border-black bg-white text-black rounded";
  // Held styles override base
  let heldClasses = "bg-black text-white border-white"; // Use white border for held for contrast

  // Size classes based on slide input
  const sizeClasses = isSlide ? "w-3 h-3 text-[10px]" : "w-5 h-5 text-sm";
  // Margin classes based on slide input
  const marginClasses = isSlide ? "" : "mx-0.25"; // Remove margin for slide input

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center font-bold align-middle", // Base layout, kept align-middle for internal centering
        sizeClasses, // Size based on case
        marginClasses, // Margin based on case
        isSlide ? "self-end" : "", // Align slide icons to bottom
        "button-icon",
        "relative z-10",
        isHeld ? heldClasses : baseClasses
      )}
      title={`${letter} Button${isHeld ? ' (Held)' : ''}`}
    >
      {letter}
    </div>
  );
});

// --- End Standalone UI Components ---

// --- Memoized Table Content Component ---
interface DataTableContentProps {
  moves: Move[];
  movesLoading: boolean;
  sortColumn: SortableColumn | null;
  sortDirection: 'asc' | 'desc';
  handleSort: (column: SortableColumn) => void;
  renderCommand: (command: string | null) => React.ReactNode;
  renderNotes: (note: string | null) => React.ReactNode;
  // Pass the component type for ExpandableHitLevels
  ExpandableHitLevelsComponent: typeof ExpandableHitLevels; 
}

// Define ExpandableHitLevels outside or ensure it's memoized where defined
// Assuming ExpandableHitLevels is already defined and memoized within FrameDataTable or imported

const DataTableContent: React.FC<DataTableContentProps> = ({ 
  moves, 
  movesLoading, 
  sortColumn, 
  sortDirection, 
  handleSort, 
  renderCommand, 
  renderNotes,
  ExpandableHitLevelsComponent
}) => {
  // Assuming ExpandableHitLevels is accessible in this scope
  // If not, it needs to be passed as a prop or defined/imported here
  
  // Reference the standalone renderBadge function
  const badgeRenderer = renderBadge;
  
  // Access memoized ExpandableHitLevels (assuming it's defined in the outer scope)
  // This pattern isn't ideal, passing components as props is better, but works if defined above
  // const ExpandableLevelsComponent = ExpandableHitLevels;

  console.log("Rendering DataTableContent..."); // Debug log

  return (
    <Table className="table-layout-fixed">
      <TableHeader className="sticky top-0 bg-card z-10">
        <TableRow className="border-b-card-border">
          {/* Stance Header */}
          <TableHead className="w-[100px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Stance')}>
            <div className="flex items-center justify-between gap-1">
              <span>Stance</span>
              {sortColumn === 'Stance' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
            </div>
          </TableHead>
          {/* Command Header */}
          <TableHead className="min-w-[210px] max-w-[300px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Command')}>
            <div className="flex items-center justify-between gap-1">
              <span>Command</span>
              {sortColumn === 'Command' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
            </div>
          </TableHead>
          {/* Hit Level Header */}
          <TableHead className="w-[135px] min-w-[135px] max-w-[150px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('HitLevel')}>
            <div className="flex items-center justify-between gap-1">
              <span>Hit Level</span>
              {sortColumn === 'HitLevel' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
            </div>
          </TableHead>
          {/* Impact Header */}
          <TableHead className="w-[50px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Impact')}>
            <div className="flex items-center justify-between gap-1">
              <span>Impact</span>
              {sortColumn === 'Impact' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
            </div>
          </TableHead>
          {/* Damage Header */}
          <TableHead className="w-[50px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Damage')}>
            <div className="flex items-center justify-between gap-1">
              <span>Damage</span>
              {sortColumn === 'Damage' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
            </div>
          </TableHead>
          {/* Block Header */}
          <TableHead className="w-[70px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Block')}>
            <div className="flex items-center justify-between gap-1" title="Block">
              <Shield size={16} />
              {sortColumn === 'Block' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
            </div>
          </TableHead>
          {/* Hit Header */}
          <TableHead className="w-[60px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Hit')}>
            <div className="flex items-center justify-between gap-1">
              <span>Hit</span>
              {sortColumn === 'Hit' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
            </div>
          </TableHead>
          {/* CH Header */}
          <TableHead title="Counter Hit" className="w-[50px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('CounterHit')}>
            <div className="flex items-center justify-between gap-1">
              <span>CH</span>
              {sortColumn === 'CounterHit' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
            </div>
          </TableHead>
          {/* GB Header */}
          <TableHead title="Guard Burst" className="w-[50px] p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('GuardBurst')}>
            <div className="flex items-center justify-between gap-1">
              <span>GB</span>
              {sortColumn === 'GuardBurst' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
            </div>
          </TableHead>
          {/* Notes Header */}
          <TableHead className="p-2 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('Notes')}>
            <div className="flex items-center justify-between gap-1">
              <span>Notes</span>
              {sortColumn === 'Notes' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movesLoading ? (
          <TableRow>
            <TableCell colSpan={10} className="text-center h-24 p-2">
              <div className="flex justify-center items-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                Loading moves...
              </div>
            </TableCell>
          </TableRow>
        ) : moves.length === 0 ? (
          <TableRow>
            <TableCell colSpan={10} className="text-center h-24 p-2">
              No moves found for this character or filter criteria.
            </TableCell>
          </TableRow>
        ) : (
          moves.map((move) => (
            <TableRow 
              key={move.ID} 
              className="border-b-card-border"
            >
              <TableCell className="text-right p-2">{move.Stance || '—'}</TableCell>
              <TableCell className="font-mono p-2 max-w-[300px] break-words">
                {renderCommand(move.Command)}
              </TableCell>
              <TableCell className="p-2 min-w-[135px] max-w-[150px] align-top">
                {/* Use the passed component */}
                <ExpandableHitLevelsComponent 
                  hitLevelString={move.HitLevel} 
                  maxIconsToShow={3}
                />
              </TableCell>
              <TableCell className="p-2">{move.Impact ?? '—'}</TableCell>
              <TableCell className="p-2">{move.DamageDec ?? '—'}</TableCell>
              <TableCell className="p-2">{badgeRenderer(move.Block, null)}</TableCell>
              <TableCell className="p-2">
                {badgeRenderer(move.Hit, move.HitString)}
              </TableCell>
              <TableCell className="p-2">
                {badgeRenderer(move.CounterHit, move.CounterHitString)}
              </TableCell>
              <TableCell className="p-2">{badgeRenderer(move.GuardBurst, null, true)}</TableCell>
              <TableCell className="max-w-[300px] p-2 overflow-visible">
                <div className="max-w-full truncate overflow-x-hidden overflow-y-visible">
                  {renderNotes(move.Notes)}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
};

const MemoizedDataTableContent = React.memo(DataTableContent);

// --- End Memoized Table Content Component ---

export const FrameDataTable: React.FC = () => {
  const params = useParams<{ gameId?: string; characterName?: string }>();
  const { gameId, characterName } = params;
  
  const navigate = useNavigate();
  const {
    selectedGame,
    setSelectedGameById,
    characters,
    setCharacters,
    selectedCharacterId,
    setSelectedCharacterId,
    availableIcons,
    getIconUrl
  } = useGame();
  
  const [db, setDb] = useState<any | null>(null);
  const [originalMoves, setOriginalMoves] = useState<Move[]>([]); // Store the original, unsorted moves
  const [loading, setLoading] = useState(true);
  const [movesLoading, setMovesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deployTimestamp, setDeployTimestamp] = useState<string>("Loading...");

  // --- Sorting State ---
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Add state for filters
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);

  // Add state for filters visibility
  const [filtersVisible, setFiltersVisible] = useState<boolean>(true);
  
  // Toggle filters visibility (Memoized)
  const toggleFiltersVisibility = useCallback(() => {
    setFiltersVisible(prev => !prev);
  }, []); // No dependencies

  // --- Effect 1: Sync URL with selectedCharacterId from Context --- 
  useEffect(() => {
    if (selectedCharacterId !== null && characters.length > 0 && selectedGame.id) {
      const selectedChar = characters.find(c => c.id === selectedCharacterId);
      if (selectedChar) {
        const expectedUrlName = encodeURIComponent(selectedChar.name);
        const currentUrlName = characterName ? encodeURIComponent(decodeURIComponent(characterName)) : undefined;
        
        // If URL doesn't match the selected character, update it - removed /character/
        if (expectedUrlName !== currentUrlName) {
           navigate(`/${selectedGame.id}/${expectedUrlName}`, { replace: true }); 
        }
      }
    }
  }, [selectedCharacterId, characters, selectedGame.id, navigate, characterName]); // Include characterName to re-check after potential navigation


  // --- Effect 2: Handle Initial Load / URL Parameters -> State --- 
  useEffect(() => {
    if (!selectedGame.id) return; // Wait for game context

    // Handle Game ID change from URL
    if (gameId && gameId !== selectedGame.id) {
      const game = AVAILABLE_GAMES.find(g => g.id === gameId);
      if (game) {
        setSelectedGameById(gameId);
        return; // Let game change propagate
      }
    }

    // Handle Character from URL *only if* characters are loaded and context doesn't have a valid selection yet
    if (characterName && characters.length > 0 && (selectedCharacterId === null || !characters.some(c => c.id === selectedCharacterId))) {
      const decodedName = decodeURIComponent(characterName);
      const characterFromName = characters.find(c => c.name.toLowerCase() === decodedName.toLowerCase());

      if (characterFromName) {
        setSelectedCharacterId(characterFromName.id);
      } else {
        // Invalid name in URL, and no valid selection in context -> default to first
        const firstCharacter = characters[0];
        if (firstCharacter) {
          setSelectedCharacterId(firstCharacter.id);
          // Let Effect 1 handle correcting the URL
        } else {
          setSelectedCharacterId(null);
        }
      }
    } else if (!characterName && characters.length > 0 && (selectedCharacterId === null || !characters.some(c => c.id === selectedCharacterId))) {
        // No character name in URL, no valid selection in context -> default to first
        const firstCharacter = characters[0];
        if (firstCharacter) {
          setSelectedCharacterId(firstCharacter.id);
          // Let Effect 1 handle correcting the URL
        }
    }

  // Dependencies focused on initial load conditions
  }, [gameId, characterName, selectedGame.id, characters, selectedCharacterId, setSelectedGameById, setSelectedCharacterId]); 


  // --- Effect 3: Load Database (based on selectedGame) --- 
  useEffect(() => {
    // Reset state when game changes
    setOriginalMoves([]); // Keep resetting moves
    setDb(null); // Reset DB
    setLoading(true); // Use loading state for DB loading
    setError(null); // Reset errors
    // setCharacters([]); // REMOVE: Characters are handled by CharacterSelectionPage now

    const loadDatabase = async () => {
      if (!selectedGame.dbPath) {
        setError("No database path configured for the selected game.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true); 
        const SQL = await window.initSqlJs();
        const response = await fetch(selectedGame.dbPath);
        if (!response.ok) throw new Error(`Failed to fetch database: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const database = new SQL.Database(uint8Array);
        setDb(database); // Set DB state for move loading
      } catch (error) {
        setError(error instanceof Error ? error.message : `Error loading database for ${selectedGame.name}`);
        setDb(null); // Clear DB on error
        // setCharacters([]); // REMOVE
      } finally {
        setLoading(false); // DB loading finished (or failed)
      }
    };

    loadDatabase();

  }, [selectedGame.dbPath]); // REMOVE setCharacters dependency
  
  // --- Effect 4: Load Moves (based on selectedCharacterId and db) --- 
  useEffect(() => {
    // Clear moves and set loading state when character changes or DB becomes available
    setOriginalMoves([]);
    if (db && selectedCharacterId !== null) { // Check for non-null ID
      setMovesLoading(true); // Start loading moves
      setError(null); // Clear previous move errors

      // Use setTimeout to ensure state update happens before query
      // This helps avoid race conditions with state updates
      const timer = setTimeout(() => {
        try {
          const movesQuery = `
            SELECT
              ID, Command, Stance, HitLevel, Impact, Damage,
              Hit, -- Select the original Hit text column
              CounterHit, -- Select the original Counter Hit text column
              BlockDec, HitDec, CounterHitDec, -- Use CounterHitDec instead of CounterHitDeci
              GuardBurst, Notes, DamageDec
            FROM Moves
            WHERE CharacterID = ?
          `;
          const movesResult = db.exec(movesQuery, [selectedCharacterId]);

          if (movesResult.length > 0 && movesResult[0].values.length > 0) {
            const columns = movesResult[0].columns;
            const values = movesResult[0].values;

            // Select the appropriate translation map based on the selected game
            const currentTranslationMap = getEffectiveTranslationMap(selectedGame.id);

            const movesData: Move[] = values.map((row: unknown[]) => {
              const moveObject: Record<string, unknown> = {};
              columns.forEach((colName: string, index: number) => {
                moveObject[colName] = row[index];
              });

              const originalCommand = String(moveObject.Command);

              // Apply translations ONLY to Command column using the selected map
              const translatedCommand = translateString(originalCommand, currentTranslationMap);

              return {
                ID: Number(moveObject.ID),
                Command: translatedCommand, // Use translated command
                Stance: moveObject.Stance ? String(moveObject.Stance) : null,
                HitLevel: moveObject.HitLevel ? String(moveObject.HitLevel) : null,
                Impact: Number(moveObject.Impact),
                Damage: moveObject.Damage ? String(moveObject.Damage) : null,
                DamageDec: moveObject.DamageDec !== null && moveObject.DamageDec !== undefined ? Number(moveObject.DamageDec) : null,
                Block: moveObject.BlockDec !== null && moveObject.BlockDec !== undefined ? Number(moveObject.BlockDec) : null,
                HitString: moveObject.Hit ? String(moveObject.Hit) : null, // Map original Hit text
                Hit: moveObject.HitDec !== null && moveObject.HitDec !== undefined ? Number(moveObject.HitDec) : null, // Numeric value for badge
                CounterHitString: moveObject.CounterHit ? String(moveObject.CounterHit) : null, // Map original Counter Hit text
                CounterHit: moveObject.CounterHitDec !== null && moveObject.CounterHitDec !== undefined ? Number(moveObject.CounterHitDec) : null, // Numeric value for badge (from CounterHitDec)
                GuardBurst: moveObject.GuardBurst !== null && moveObject.GuardBurst !== undefined ? Number(moveObject.GuardBurst) : null,
                Notes: moveObject.Notes ? String(moveObject.Notes) : null // Use original notes
              };
            });
            setOriginalMoves(movesData);
          } else {
            setOriginalMoves([]);
          }
        } catch (error) {
          setError(error instanceof Error ? error.message : `Unknown error loading moves for character ID ${selectedCharacterId}`);
          setOriginalMoves([]);
        } finally {
          setMovesLoading(false); // Finish loading moves
        }
      }, 0); // Execute async query shortly after state update

      // Cleanup timeout if effect re-runs before timeout completes
      return () => clearTimeout(timer);

    } else {
       // If no DB or character selected, ensure moves are empty and not loading
       setOriginalMoves([]); // Clear original moves
       setMovesLoading(false);
    }
  }, [db, selectedCharacterId]); // Removed setError from dependencies

  // --- Handler for Sort Click ---
  const handleSort = useCallback((column: SortableColumn) => {
    setSortColumn(prevColumn => {
      if (prevColumn === column) {
        setSortDirection(prevDir => (prevDir === 'asc' ? 'desc' : 'asc'));
        return prevColumn; // No change to column
      } else {
        setSortDirection('asc'); // Reset direction for new column
        return column; // Set new column
      }
    });
  }, []); // No dependencies

  // Helper to render Command text with inline icons (Memoized)
  const renderCommand = useCallback((command: string | null) => {
    if (!command) { return '—'; }

    const parts: React.ReactNode[] = [];
    // Build regex dynamically based on ALL available game icons from context
    const allIconCodes = availableIcons.map(ic => ic.code);

    if (allIconCodes.length === 0) { 
      return command; // No icons configured, return original text
    }

    // Define which codes should use the ButtonIcon component
    const buttonCodes = new Set(['A', 'B', 'K', 'G']); // Add more if needed

    // General pattern for allowed characters in codes (adjust if needed)
    const codeCharPattern = '[A-Z0-9]+'; 
    // Regex to match sequences like :A:, :B+K:, :(A+B+K):, :UA:, etc.
    // Captures: 1=optional '(', 2=code sequence (e.g., "A", "B+K", "UA"), 3=optional ')'
    const regex = new RegExp(`:(\\()?(${codeCharPattern}(?:[+]${codeCharPattern})*)(\\))?:`, 'gi'); 

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(command))) {
      const [fullMatch, openParen, codeSequence, closeParen] = match;
      const start = match.index;

      // Push text before the current match
      if (start > lastIndex) {
        parts.push(command.slice(lastIndex, start));
      }

      // Check if codeSequence was captured (valid match)
      if (codeSequence !== undefined) {
        const isHeld = !!(openParen && closeParen);
        
        // Check if it contains a plus sign for combined buttons
        if (codeSequence.includes('+')) {
          const combinedCodes = codeSequence.split('+');
          combinedCodes.forEach((code, index) => {
            // Check original case to determine if it's a slide input
            const isSlide = code !== code.toUpperCase(); // Check original case, renamed variable
            // Ensure the individual code part is a known button code
            if (buttonCodes.has(code.toUpperCase())) {
              parts.push(<ButtonIcon key={`${code}-${start}-${index}-${isHeld}-${isSlide}`} code={code} isHeld={isHeld} isSlide={isSlide} />); // Pass isSlide
              if (index < combinedCodes.length - 1) {
                // Add styled '+' separator circle that overlaps
                parts.push(
                  <span 
                    key={`plus-${start}-${index}`} 
                    className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-white text-black border border-black text-xs font-bold z-20 -ml-1.5 -mr-1.5 plus-separator relative" // Reverted to w-3 h-3, adjusted margins
                  >
                    +
                  </span>
                );
              }
            } else {
              // If part of a combined sequence isn't a button, render the original text part
              console.warn('renderCommand: Non-button code found in combined sequence:', code, codeSequence);
              // Render the problematic code part as text, potentially with surrounding separators?
              // For now, just pushing the original full match might be safest fallback
              // To avoid duplication, check if already pushed
              if (parts[parts.length - 1] !== fullMatch) { 
                 parts.push(fullMatch);
              }
              // Bail out of processing this specific combined sequence
              return; // Exit forEach early
            }
          });
        } else { 
          // --- Process Single Code (no plus sign) ---
          const singleCode = codeSequence; 
          // Check original case to determine if it's a slide input
          const isSlide = singleCode !== singleCode.toUpperCase(); // Check original case, renamed variable
          // Check if it's a button code to render ButtonIcon
          if (buttonCodes.has(singleCode.toUpperCase())) {
            parts.push(<ButtonIcon key={`${singleCode}-${start}-${isHeld}-${isSlide}`} code={singleCode} isHeld={isHeld} isSlide={isSlide} />); // Pass isSlide
          } else {
            // Otherwise, check if it's a known SVG icon code from context
            const iconConfig = availableIcons.find(ic => ic.code.toUpperCase() === singleCode.toUpperCase());
            if (iconConfig) {
              // Render as an SVG image using context config
              const titleText = getIconTooltip(singleCode, availableIcons);
              // Determine size based on slide input and icon type
              let svgSizeClass = "h-4 w-4"; // Default size
              if (isSlide) {
                svgSizeClass = "h-2 w-2"; // Slide size
              } else if (/^[1-9]$/.test(singleCode)) {
                svgSizeClass = "h-5 w-5"; // Directional icon size matches ButtonIcon
              }
              // Determine margin based on slide input or if it's a directional icon
              const svgMarginClass = (isSlide || /^[1-9]$/.test(singleCode)) ? "" : "mx-0.5"; // Remove margin for slide OR directional
              const classes = cn(
                "inline object-contain align-middle", // Base layout for SVGs
                svgSizeClass, // Size based on case
                isSlide ? "self-end" : "", // Align slide icons to bottom
                iconConfig.className, // Game-specific overrides from context
                svgMarginClass // Margin based on case
              );
              parts.push(
                <img
                  key={`${singleCode}-${start}-${isSlide}-${isHeld}`}
                  src={getIconUrl(singleCode, isHeld)} // Pass isHeld to getIconUrl
                  alt={singleCode}
                  title={titleText}
                  className={cn(classes, svgMarginClass)}
                />
              );
            } else {
              // Fallback: Code not recognized as button or SVG icon, render original text.
              console.warn('renderCommand: Unrecognized single code sequence:', singleCode);
              parts.push(fullMatch);
            }
          }
          // --- End Process Single Code ---
        }
      } else {
        // Invalid match structure (should be rare with the new regex) - Treat as literal text
        console.warn('renderCommand: Regex matched invalid sequence structure. Treating as text:', { fullMatch, command });
        parts.push(fullMatch); 
      }
      
      // Update lastIndex for the next iteration
      lastIndex = regex.lastIndex;
    }
    // Push any remaining text after the last match
    if (lastIndex < command.length) {
      parts.push(command.slice(lastIndex));
    }
    
    // Wrap the entire sequence in a flex container, aligning items to the center vertically
    return <span className="inline-flex items-center flex-wrap">{parts}</span>;
  }, [availableIcons, getIconUrl]); // Dependencies: availableIcons, getIconUrl

  // Helper to render Notes text with inline icons (Memoized)
  const renderNotes = useCallback((note: string | null) => {
    if (!note) { return '—'; }

    const parts: React.ReactNode[] = [];
    // Build regex to match only configured icon codes
    const codes = availableIcons.map(ic => ic.code).join('|');
    const regex = new RegExp(`:(${codes}):`, 'g');
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(note))) {
      const [full, iconName] = match;
      const start = match.index;
      if (start > lastIndex) {
        parts.push(note.slice(lastIndex, start));
      }
      // iconName is guaranteed to be in availableIcons
      const iconConfig = availableIcons.find(ic => ic.code === iconName);
      if (iconConfig) {
        // Pass availableIcons to the moved helper function
        const titleText = getIconTooltip(iconName, availableIcons);
        const classes = cn(
          "inline object-contain align-text-bottom h-4 w-4",
          iconConfig.className
        );
        // Wrap in a hover group to show tooltip
        parts.push(
          <img
            key={`${iconName}-${start}`}
            src={getIconUrl(iconName)}
            alt={iconName}
            title={titleText}
            className={cn(classes, 'mx-0.5')}
          />
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < note.length) {
      parts.push(note.slice(lastIndex));
    }
    return parts;
  }, [availableIcons, getIconUrl]); // Dependencies: availableIcons, getIconUrl

  // Helper function to get field value based on field name
  const getFieldValue = (move: Move, fieldName: string): any => {
    switch (fieldName) {
      case 'Damage':
        return move.DamageDec;
      case 'Hit':
        return move.Hit;
      case 'CounterHit':
        return move.CounterHit;
      default:
        return move[fieldName as keyof Move];
    }
  };

  // compute displayedMoves via memoization instead of state
  const displayedMoves = React.useMemo(() => {
    // First, apply filters
    let filteredMoves = [...originalMoves];
    
    if (activeFilters.length > 0) {
      filteredMoves = filteredMoves.filter(move => {
        // All filters must match (AND logic)
        return activeFilters.every(filter => {
          const fieldValue = getFieldValue(move, filter.field);
          if (fieldValue === null || fieldValue === undefined) return false;
          
          const fieldValueStr = String(fieldValue).toLowerCase();
          const filterValueLower = filter.value.toLowerCase();
          
          switch (filter.condition) {
            case 'equals':
              return fieldValueStr === filterValueLower;
            case 'notEquals':
              return fieldValueStr !== filterValueLower;
            case 'greaterThan':
              return !isNaN(Number(fieldValue)) && !isNaN(Number(filter.value)) && 
                     Number(fieldValue) > Number(filter.value);
            case 'lessThan':
              return !isNaN(Number(fieldValue)) && !isNaN(Number(filter.value)) && 
                     Number(fieldValue) < Number(filter.value);
            case 'between':
              if (!filter.value2) return false;
              const min = Number(filter.value);
              const max = Number(filter.value2);
              const val = Number(fieldValue);
              return !isNaN(min) && !isNaN(max) && !isNaN(val) && 
                     val >= min && val <= max;
            case 'notBetween':
              if (!filter.value2) return false;
              const notMin = Number(filter.value);
              const notMax = Number(filter.value2);
              const notVal = Number(fieldValue);
              return !isNaN(notMin) && !isNaN(notMax) && !isNaN(notVal) && 
                     (notVal < notMin || notVal > notMax);
            case 'contains':
              return fieldValueStr.includes(filterValueLower);
            case 'startsWith':
              return fieldValueStr.startsWith(filterValueLower);
            default:
              return true;
          }
        });
      });
    }
    
    // Then apply sorting
    if (!sortColumn) return filteredMoves;
    
    const sorted = [...filteredMoves].sort((a, b) => {
      let valA: any;
      let valB: any;
      switch (sortColumn) {
        case 'Damage':
          valA = a.DamageDec; valB = b.DamageDec; break;
        case 'Block':
          valA = a.Block; valB = b.Block; break;
        case 'Hit':
          valA = a.Hit; valB = b.Hit; break;
        case 'CounterHit':
          valA = a.CounterHit; valB = b.CounterHit; break;
        default:
          // Use getFieldValue to handle potential mapped columns like OriginalCommand
          valA = getFieldValue(a, sortColumn);
          valB = getFieldValue(b, sortColumn);
      }
      // Push null/undefined to bottom
      const aNull = valA == null;
      const bNull = valB == null;
      if (aNull && !bNull) return 1;
      if (!aNull && bNull) return -1;
      if (aNull && bNull) return 0;
      const order = sortDirection === 'asc' ? 1 : -1;
      if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * order;
      if (typeof valA === 'string' && typeof valB === 'string') return valA.localeCompare(valB) * order;
      return 0;
    });
    return sorted;
  }, [originalMoves, sortColumn, sortDirection, activeFilters]);

  // Handle filter changes (Memoized)
  const handleFiltersChange = useCallback((filters: FilterCondition[]) => {
    setActiveFilters(filters);
  }, []); // No dependencies

  // New useEffect to fetch the timestamp
  useEffect(() => {
    fetch('/timestamp.json')
      .then(res => res.json())
      .then(data => {
        setDeployTimestamp(data.timestamp);
      })
      .catch(err => {
        // Failed to load timestamp, no debug logging
        setDeployTimestamp("Unknown");
      });
  }, []);

  // Inject CSS styles for transitions
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
      .filter-container {
        transition: all 0.25s ease-in-out;
        transform-origin: top center;
      }
      
      .filter-container.visible {
        opacity: 1;
        transform: scaleY(1);
        margin-top: 12px;
        pointer-events: all;
      }
      
      .filter-container.hidden {
        opacity: 0;
        transform: scaleY(0);
        margin-top: 0;
        max-height: 0;
        pointer-events: none;
      }
      
      /* Special case for empty filters */
      .filter-container.empty.visible {
        transition: all 0.1s ease-out;
      }
      
      .filter-container.empty.hidden {
        transition: all 0.1s ease-in;
      }
      
      .title-interactive {
        position: relative;
        padding: 6px 10px;
        margin: -6px -10px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }
      
      .title-interactive:hover {
        background-color: rgba(255, 255, 255, 0.05);
      }
      
      .title-interactive:active {
        background-color: rgba(255, 255, 255, 0.1);
      }
    `;
    
    document.head.appendChild(styleEl);
    
    // Return cleanup function
    return () => {
      if (styleEl && document.head.contains(styleEl)) {
        document.head.removeChild(styleEl);
      }
    };
  }, []);

  // Inject ::selection styles for custom icons
  useEffect(() => {
    const selectionStyleId = 'custom-icon-selection-styles';
    let styleEl = document.getElementById(selectionStyleId) as HTMLStyleElement | null;
    
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = selectionStyleId;
      styleEl.innerHTML = `
        /* Style the text inside ButtonIcon when selected */
        .button-icon::selection {
          background-color: #3390FF; /* Standard selection blue */
          color: white;
        }
        /* Style the text inside the plus separator when selected */
        .plus-separator::selection {
          background-color: #3390FF;
          color: white;
        }
      `;
      document.head.appendChild(styleEl);
    }

    // Cleanup function
    return () => {
      const existingStyleEl = document.getElementById(selectionStyleId);
      if (existingStyleEl && document.head.contains(existingStyleEl)) {
        // Optional: Remove on component unmount if desired, or leave for performance
        // document.head.removeChild(existingStyleEl);
      }
    };
  }, []); // Run once on mount

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        {/* Keep Initialize button for potential manual schema creation */}
        {db && (
          <CardContent>
            <Button 
              onClick={async () => {
                try {
                  const success = await initializeDatabase(db);
                  if (success) {
                    alert("Database initialized successfully! Reloading data...");
                    // Re-trigger data loading instead of full page reload
                    setError(null); // Clear error
                    // Re-fetch characters and potentially moves depending on logic
                    // This might need a more robust state refresh mechanism
                    window.location.reload(); // Simple reload for now
                  } else {
                    alert("Failed to initialize database.");
                  }
                } catch (err) {
                  alert(`Error initializing database: ${err}`);
                }
              }}
            >
              Attempt Database Initialization
            </Button>
          </CardContent>
        )}
      </Card>
    );
  }

  // Get selected character name based on the ID stored in context
  const selectedCharacterNameFromContext = selectedCharacterId
    ? characters.find(c => c.id === selectedCharacterId)?.name
    : null;

  return (
    <div className="space-y-6 h-full flex flex-col pl-4 pr-4 flex-grow">
      {selectedCharacterId ? (
        <Card className="h-full flex flex-col overflow-hidden border border-card-border">
          <CardHeader className="pb-2 flex-shrink-0">
            <div className="flex justify-between items-center">
              <div 
                className="flex items-center cursor-pointer group title-interactive" 
                onClick={toggleFiltersVisibility}
                title={filtersVisible ? "Click to hide filters" : "Click to show filters"}
              >
                <CardTitle className="flex items-center">
                  {selectedCharacterNameFromContext || 'Character'} Frame Data
                  <ChevronRight 
                    className={cn(
                      "ml-2 h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
                      filtersVisible ? "transform rotate-90" : ""
                    )} 
                  />
                </CardTitle>
                <ActiveFiltersBadge count={activeFilters.length} />
              </div>
              <CardDescription className="m-0">
                Total Moves: {displayedMoves.length} {originalMoves.length !== displayedMoves.length ? 
                  `(filtered from ${originalMoves.length})` : ''}
              </CardDescription>
            </div>
            
            <div className={`filter-container ${filtersVisible ? 'visible' : 'hidden'} ${activeFilters.length === 0 ? 'empty' : ''}`}>
              <FilterBuilder 
                onFiltersChange={handleFiltersChange} 
                moves={originalMoves}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-grow p-0 flex flex-col overflow-visible">
            <div className="overflow-y-auto flex-grow">
              {/* Render the memoized table content */}
              <MemoizedDataTableContent 
                moves={displayedMoves} 
                movesLoading={movesLoading}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                handleSort={handleSort}
                renderCommand={renderCommand}
                renderNotes={renderNotes}
                ExpandableHitLevelsComponent={ExpandableHitLevels}
              />
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground flex-shrink-0">
            Website last deployed: {deployTimestamp}
          </CardFooter>
        </Card>
      ) : (
        <div className="flex items-center justify-center h-48 border rounded-lg bg-muted/40">
          <p className="text-muted-foreground">
            {characters.length > 0 ? "Select a character to view frame data" : "No characters loaded."}
          </p>
        </div>
      )}
    </div>
  );
}; 