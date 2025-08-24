let tooltipElement: HTMLDivElement | null = null;

export const showTooltip = (html: string, event: MouseEvent): void => {
  // Remove any existing tooltip
  hideTooltip();

  // Create tooltip element
  tooltipElement = document.createElement('div');
  tooltipElement.className = 'construction-tooltip';
  tooltipElement.innerHTML = html;
  
  // Style the tooltip
  Object.assign(tooltipElement.style, {
    position: 'absolute',
    padding: '10px',
    background: 'rgba(0, 0, 0, 0.9)',
    color: 'white',
    borderRadius: '6px',
    pointerEvents: 'none',
    zIndex: '9999',
    fontSize: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
    maxWidth: '300px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  });

  // Append to body
  document.body.appendChild(tooltipElement);

  // Position the tooltip
  positionTooltip(event);
};

export const moveTooltip = (event: MouseEvent): void => {
  if (tooltipElement) {
    positionTooltip(event);
  }
};

export const hideTooltip = (): void => {
  if (tooltipElement) {
    document.body.removeChild(tooltipElement);
    tooltipElement = null;
  }
};

const positionTooltip = (event: MouseEvent): void => {
  if (!tooltipElement) return;

  const offset = 10;
  let left = event.pageX + offset;
  let top = event.pageY - offset;

  // Get tooltip dimensions
  const tooltipRect = tooltipElement.getBoundingClientRect();
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // Adjust horizontal position if tooltip would go off right edge
  if (left + tooltipRect.width > windowWidth + window.scrollX) {
    left = event.pageX - tooltipRect.width - offset;
  }

  // Adjust vertical position if tooltip would go off top edge
  if (top < window.scrollY) {
    top = event.pageY + offset;
  }

  // Adjust vertical position if tooltip would go off bottom edge
  if (top + tooltipRect.height > windowHeight + window.scrollY) {
    top = event.pageY - tooltipRect.height - offset;
  }

  tooltipElement.style.left = `${left}px`;
  tooltipElement.style.top = `${top}px`;
};
