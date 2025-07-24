import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { formatNumber, tickToTime } from '../utils/charts';

interface DataPoint {
  tick: number;
  value: number;
}

interface PlayerLine {
  id: string;
  name: string;
  color: string;
  data: DataPoint[];
}

interface LineChartProps {
  data: PlayerLine[];
  width?: number;
  height?: number;
  title: string;
  yAxisLabel: string;
}

const LineChart: React.FC<LineChartProps> = ({
  data,
  width = 800,
  height = 400,
  title,
  yAxisLabel,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    const margin = { top: 20, right: 120, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Get all data points for scales
    const allDataPoints = data.flatMap(player => player.data);
    if (!allDataPoints.length) return;

    // Create scales
    const xScale = d3.scaleLinear()
      .domain(d3.extent(allDataPoints, d => d.tick) as [number, number])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(allDataPoints, d => d.value) || 0])
      .nice()
      .range([innerHeight, 0]);

    // Create line generator
    const line = d3.line<DataPoint>()
      .x(d => xScale(d.tick))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text(title);

    // Add X axis
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .tickFormat(d => tickToTime(d as number))
        .ticks(8));

    // Add Y axis
    const yAxis = g.append('g')
      .call(d3.axisLeft(yScale)
        .tickFormat(d => formatNumber(d as number))
        .ticks(6));

    // Add axis labels
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 10)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Game Time');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(yAxisLabel);

    // Add grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .tickSize(-innerHeight)
        .tickFormat(() => '')
        .ticks(8))
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.3);

    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale)
        .tickSize(-innerWidth)
        .tickFormat(() => '')
        .ticks(6))
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.3);

    // Add lines for each player
    data.forEach(player => {
      if (player.data.length === 0) return;

      g.append('path')
        .datum(player.data)
        .attr('fill', 'none')
        .attr('stroke', player.color)
        .attr('stroke-width', 2)
        .attr('d', line);

      // Add dots for data points
      g.selectAll(`.dot-${player.id}`)
        .data(player.data.filter((_, i) => i % Math.max(1, Math.floor(player.data.length / 20)) === 0)) // Sample points for performance
        .enter().append('circle')
        .attr('class', `dot-${player.id}`)
        .attr('cx', d => xScale(d.tick))
        .attr('cy', d => yScale(d.value))
        .attr('r', 3)
        .attr('fill', player.color)
        .style('opacity', 0.7);
    });

    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - 110}, 40)`);

    data.forEach((player, i) => {
      const legendRow = legend.append('g')
        .attr('transform', `translate(0, ${i * 20})`);

      legendRow.append('rect')
        .attr('width', 12)
        .attr('height', 2)
        .attr('fill', player.color);

      legendRow.append('text')
        .attr('x', 16)
        .attr('y', 6)
        .style('font-size', '12px')
        .text(player.name.length > 12 ? player.name.substring(0, 12) + '...' : player.name);
    });

    // Add tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('padding', '10px')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('border-radius', '4px')
      .style('pointer-events', 'none')
      .style('opacity', 0);

    // Add invisible overlay for mouse events
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mousemove', function(event) {
        const [mouseX] = d3.pointer(event);
        const tick = Math.round(xScale.invert(mouseX));
        
        // Find closest data points for each player at this tick
        const closestPoints = data.map(player => {
          const closest = player.data.reduce((prev, curr) => 
            Math.abs(curr.tick - tick) < Math.abs(prev.tick - tick) ? curr : prev
          );
          return { ...closest, player: player.name, color: player.color };
        }).filter(point => Math.abs(point.tick - tick) < 100); // Only show if reasonably close

        if (closestPoints.length > 0) {
          const tooltipContent = `
            <div><strong>Time: ${tickToTime(tick)}</strong></div>
            ${closestPoints.map(point => 
              `<div style="color: ${point.color}">${point.player}: ${formatNumber(point.value)}</div>`
            ).join('')}
          `;

          tooltip
            .style('opacity', 1)
            .html(tooltipContent)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        }
      })
      .on('mouseout', () => {
        tooltip.style('opacity', 0);
      });

    // Cleanup function
    return () => {
      tooltip.remove();
    };

  }, [data, width, height, title, yAxisLabel]);

  return (
    <div className="line-chart">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ border: '1px solid #ddd', borderRadius: '4px' }}
      />
    </div>
  );
};

export default LineChart;
