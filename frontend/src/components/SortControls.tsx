import React from 'react';
import { SortBy } from '../types';

interface SortControlsProps {
  sortBy: SortBy;
  setSortBy: (sort: SortBy) => void;
}

const SortControls: React.FC<SortControlsProps> = ({
  sortBy,
  setSortBy
}) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '20px',
      marginBottom: '20px',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label>Sort by:</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid #ccc'
          }}
        >
          <option value="last_seen">Last Seen</option>
          <option value="players">Player Count</option>
          <option value="map">Map Name</option>
        </select>
      </div>
    </div>
  );
};

export default SortControls;
