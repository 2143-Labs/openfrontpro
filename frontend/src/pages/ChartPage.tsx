import React from 'react';
import { useParams } from 'react-router-dom';
import LineChart from '../components/LineChart';
import { formatPlayerStatsForChart, PlayerStatsOnTick, PlayerStatsOverGame, GeneralEvent, DisplayEvent } from '../utils/charts';

interface ChartPageProps {
  statsData: PlayerStatsOverGame;
  generalEvents: GeneralEvent[];
  displayEvents: DisplayEvent[];
}

const ChartPage: React.FC<ChartPageProps> = ({ statsData, generalEvents, displayEvents }) => {
  const { gameID } = useParams<{ gameID: string }>();

  const troopsData = formatPlayerStatsForChart(statsData, 'troops');
  const goldData = formatPlayerStatsForChart(statsData, 'gold');
  const workersData = formatPlayerStatsForChart(statsData, 'workers');

  return (
    <div className="chart-page">
      <h1>Game {gameID} Analysis</h1>

      <LineChart 
        data={troopsData} 
        title="Troops Over Time" 
        yAxisLabel="Troops"
      />
      <LineChart 
        data={goldData} 
        title="Gold Over Time" 
        yAxisLabel="Gold"
      />
      <LineChart 
        data={workersData} 
        title="Workers Over Time" 
        yAxisLabel="Workers"
      />
    </div>
  );
};

export default ChartPage;

