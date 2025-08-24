import React from 'react';
import { render } from '@testing-library/react';
import MiniMapSpot from './MiniMapSpot';

describe('MiniMapSpot', () => {
  const defaultProps = {
    mapWidth: 2000,
    mapHeight: 1000, 
    x: 1000,  // Center X
    y: 500,   // Center Y
    color: '#ff0000'
  };

  it('renders without crashing', () => {
    render(<MiniMapSpot {...defaultProps} />);
  });

  it('handles invalid map dimensions gracefully', () => {
    const { container } = render(
      <MiniMapSpot 
        mapWidth={0} 
        mapHeight={0} 
        x={100} 
        y={100} 
        color="#ff0000" 
      />
    );
    
    expect(container.textContent).toContain('N/A');
  });

  it('respects aspect ratio for wide maps', () => {
    const { container } = render(
      <MiniMapSpot 
        {...defaultProps}
        mapWidth={2000}  // 2:1 aspect ratio
        mapHeight={1000}
        size={40}
      />
    );
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    
    // For a 2:1 aspect ratio with size=40, width should be 40, height should be 20
    expect(svg).toHaveAttribute('width', '40');
    expect(svg).toHaveAttribute('height', '20');
  });

  it('respects aspect ratio for tall maps', () => {
    const { container } = render(
      <MiniMapSpot 
        mapWidth={1000}  // 1:2 aspect ratio (tall)
        mapHeight={2000}
        x={500}
        y={1000}
        color="#00ff00"
        size={40}
      />
    );
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    
    // For a 1:2 aspect ratio with size=40, width should be 20, height should be 40
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '40');
  });

  it('places the spot correctly at center position', () => {
    const { container } = render(
      <MiniMapSpot 
        mapWidth={100}
        mapHeight={100} 
        x={50}  // Center
        y={50}  // Center
        color="#0000ff"
        size={40}
      />
    );
    
    const circle = container.querySelector('circle');
    expect(circle).toBeInTheDocument();
    
    // For a square map centered at 50,50 with size 40x40, circle should be at 20,20
    expect(circle).toHaveAttribute('cx', '20');
    expect(circle).toHaveAttribute('cy', '20');
  });

  it('uses the provided color', () => {
    const testColor = '#123456';
    const { container } = render(<MiniMapSpot {...defaultProps} color={testColor} />);
    
    const circle = container.querySelector('circle');
    expect(circle).toHaveAttribute('fill', testColor);
  });

  it('has proper styling attributes', () => {
    const { container } = render(<MiniMapSpot {...defaultProps} />);
    
    const svg = container.querySelector('svg');
    const circle = container.querySelector('circle');
    
    expect(svg).toHaveStyle('backgroundColor: #f8f9fa');
    expect(circle).toHaveAttribute('stroke', 'white');
    expect(circle).toHaveAttribute('opacity', '0.9');
  });
});
