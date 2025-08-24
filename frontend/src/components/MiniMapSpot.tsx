import React from 'react';
import { showTooltip, moveTooltip, hideTooltip } from '../utils/tooltip';
import { tickToTime } from '../utils/charts';

interface MiniMapSpotProps {
  mapWidth: number;
  mapHeight: number;
  x: number;
  y: number;
  color: string;
  size?: number;
  // Optional tooltip data
  unitType?: string;
  playerName?: string;
  level?: number;
  tick?: number;
}

const MiniMapSpot: React.FC<MiniMapSpotProps> = ({
  mapWidth,
  mapHeight,
  x,
  y,
  color,
  size = 40,
  unitType,
  playerName,
  level,
  tick,
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

  // Generate enlarged SVG for tooltip (4x larger)
  const generateEnlargedSVG = (): string => {
    const enlargedSize = 160;
    const enlargedAspectRatio = mapWidth / mapHeight;
    let enlargedViewWidth = enlargedSize;
    let enlargedViewHeight = enlargedSize;
    
    // Maintain aspect ratio while staying within bounds
    if (enlargedAspectRatio > 1) {
      enlargedViewHeight = enlargedSize / enlargedAspectRatio;
    } else {
      enlargedViewWidth = enlargedSize * enlargedAspectRatio;
    }
    
    const enlargedSpotX = (x / mapWidth) * enlargedViewWidth;
    const enlargedSpotY = (y / mapHeight) * enlargedViewHeight;
    const enlargedSpotRadius = Math.max(2, Math.min(enlargedViewWidth, enlargedViewHeight) / 15);
    
    return `
      <svg
        width="${enlargedViewWidth}"
        height="${enlargedViewHeight}"
        viewBox="0 0 ${enlargedViewWidth} ${enlargedViewHeight}"
        style="
          border: 1px solid #dee2e6;
          border-radius: 4px;
          background-color: #f8f9fa;
          display: block;
        "
      >
        <circle
          cx="${enlargedSpotX}"
          cy="${enlargedSpotY}"
          r="${enlargedSpotRadius}"
          fill="${color}"
          stroke="white"
          stroke-width="1"
          opacity="0.9"
        />
      </svg>
    `;
  };

  // Generate tooltip content
  const generateTooltipContent = (): string => {
    const hasTooltipData = unitType || playerName || level !== undefined;
    
    if (!hasTooltipData) {
      return `
        <div style="font-size: 12px; margin-bottom: 8px;">
          <strong>Construction Location</strong><br/>
          Coordinates: (${x}, ${y})
        </div>
        ${generateEnlargedSVG()}
      `;
    }
    
    return `
      <div style="font-size: 12px; margin-bottom: 8px; line-height: 1.4;">
        ${unitType ? `<strong>${unitType}</strong><br/>` : ''}
        ${playerName ? `Player: ${playerName}<br/>` : ''}
        Coordinates: (${x}, ${y})${level !== undefined ? ` Level ${level}` : ''}
        ${tick !== undefined ? `<br/>Time: ${tickToTime(tick)}` : ''}
      </div>
      ${generateEnlargedSVG()}
    `;
  };

  // Event handlers
  const handleMouseEnter = (event: React.MouseEvent) => {
    const tooltipContent = generateTooltipContent();
    showTooltip(tooltipContent, event.nativeEvent);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    moveTooltip(event.nativeEvent);
  };

  const handleMouseLeave = () => {
    hideTooltip();
  };

  return (
    <div 
      style={{ display: 'inline-block', cursor: 'pointer' }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      aria-describedby={unitType ? `minimap-${x}-${y}` : undefined}
    >
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
