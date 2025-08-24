// Event display utilities extracted from EventsTimeline for shared use

export const getCategoryColor = (type: 'general' | 'display'): string => {
  return type === 'general' ? '#007bff' : '#28a745'; // Blue for general, green for display
};

export const getCategoryIcon = (category: string, type: 'general' | 'display'): string => {
  // Icons for different event types for quick visual parsing
  const iconMap: Record<string, string> = {
    // General events
    'player_spawn': '👤',
    'player_death': '💀',
    'game_start': '🎮',
    'game_end': '🏁',
    'unit_created': '⚔️',
    'building_constructed': '🏗️',
    'resource_gathered': '💰',
    'battle': '⚡',
    'trade': '🤝',
    'conquestEvent': '🏰',
    'allianceRequest': '🤝',
    'allianceRequestReply': '📩',
    'embargoEvent': '🚫',
    'railroadEvent': '🚂',
    'bonusEvent': '💎',
    'unitIncoming': '⚠️',
    'emoji': '😀',
    
    // Display events
    'chat': '💬',
    'system': '🔧',
    'notification': '📢',
    'warning': '⚠️',
    'error': '❌',
    'info': 'ℹ️',
  };

  return iconMap[category.toLowerCase()] || (type === 'general' ? '📊' : '📝');
};

export const formatEventTypeLabel = (type: 'general' | 'display'): string => {
  return type === 'general' ? 'GEN' : 'DIS';
};
