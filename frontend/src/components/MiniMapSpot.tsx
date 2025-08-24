import React from 'react';

interface MiniMapSpotProps {
  mapWidth: number;
  mapHeight: number;
  x: number;
  y: number;
  color: string;
  size?: number;
}

const MiniMapSpot: React.FC<MiniMapSpotProps> = ({
  mapWidth,
  mapHeight,
  x,
  y,
  color,
  size = 40,
}) => {
  // Handle invalid or missing map dimensions
  if (!mapWidth || !mapHeight || mapWidth <= 0 || mapHeight <= 0) {
    return (
      <div 
        style={{ 
          width: size, 
          height: size, 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          color: '#6c757d'
        }}
      >
        N/A
      </div>
    );
  }

  // Calculate aspect ratio and dimensions
  const aspectRatio = mapWidth / mapHeight;
  let viewWidth = size;
  let viewHeight = size;
  
  // Maintain aspect ratio while staying within size bounds
  if (aspectRatio > 1) {
    // Map is wider than tall
    viewHeight = size / aspectRatio;
  } else {
    // Map is taller than wide  
    viewWidth = size * aspectRatio;
  }

  // Calculate spot position (scaled to minimap dimensions)
  const spotX = (x / mapWidth) * viewWidth;
  const spotY = (y / mapHeight) * viewHeight;

  return (
    <div style={{ display: 'inline-block' }}>
      <svg
        width={viewWidth}
        height={viewHeight}
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        style={{
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          backgroundColor: '#f8f9fa'
        }}
      >
        {/* Construction spot */}
        <circle
          cx={spotX}
          cy={spotY}
          r={Math.max(1, Math.min(viewWidth, viewHeight) / 20)} // Scale circle size to minimap
          fill={color}
          stroke="white"
          strokeWidth="0.5"
          opacity={0.9}
        />
      </svg>
    </div>
  );
};

export default MiniMapSpot;
