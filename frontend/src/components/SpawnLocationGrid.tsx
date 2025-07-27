import React from 'react';
import { GamePlayer, getPlayerColor } from '../utils/charts';

interface SpawnLocationGridProps {
  mapWidth: number;
  mapHeight: number;
  players: GamePlayer[];
  maxRenderWidth?: number;
}

const SpawnLocationGrid: React.FC<SpawnLocationGridProps> = ({
  mapWidth,
  mapHeight,
  players,
  maxRenderWidth = 450,
}) => {
  // Handle invalid or missing map dimensions
  if (!mapWidth || !mapHeight || mapWidth <= 0 || mapHeight <= 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>Invalid map dimensions</p>
      </div>
    );
  }

  // Filter players with valid spawn info
  const playersWithSpawns = players.filter(
    player => player.spawn_info && 
    typeof player.spawn_info.x === 'number' && 
    typeof player.spawn_info.y === 'number'
  );

  // Handle no spawns case
  if (playersWithSpawns.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No spawn locations available</p>
      </div>
    );
  }

  // Calculate aspect ratio and dimensions
  const aspectRatio = mapWidth / mapHeight;
  const viewWidth = maxRenderWidth;
  const viewHeight = viewWidth / aspectRatio;

  // Show labels when there's enough space
  const showLabels = viewWidth > 300;

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* SVG Map */}
      <svg
        width={viewWidth}
        height={viewHeight}
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        className="border border-gray-300 rounded bg-gray-50"
      >
        {/* Background grid (optional light grid lines) */}
        <defs>
          <pattern
            id="grid"
            width={viewWidth / 10}
            height={viewHeight / 10}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${viewWidth / 10} 0 L 0 0 0 ${viewHeight / 10}`}
              fill="none"
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Player spawn circles */}
        {playersWithSpawns.map((player, index) => {
          const cx = (player.spawn_info!.x / mapWidth) * viewWidth;
          const cy = (player.spawn_info!.y / mapHeight) * viewHeight;
          const color = getPlayerColor(index);

          return (
            <g key={player.id}>
              {/* Player circle */}
              <circle
                cx={cx}
                cy={cy}
                r={showLabels ? 6 : 4}
                fill={color}
                stroke="white"
                strokeWidth="2"
                opacity={0.8}
              />
              
              {/* Player label */}
              {showLabels && (
                <text
                  x={cx + 10}
                  y={cy + 4}
                  fontSize="12"
                  fontFamily="sans-serif"
                  fill={color}
                  fontWeight="500"
                >
                  {player.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>


      {/* Map info */}
      <div className="text-xs text-gray-500 text-center">
        Map: {mapWidth} × {mapHeight}
      </div>
    </div>
  );
};

export default SpawnLocationGrid;
