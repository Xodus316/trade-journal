interface ScatterPoint {
  x: number;
  y: number;
  label: string;
  tone: 'positive' | 'negative';
}

interface ScatterPlotProps {
  points: ScatterPoint[];
  formatY: (value: number) => string;
}

export function ScatterPlot({ points, formatY }: ScatterPlotProps) {
  if (points.length === 0) {
    return <div className="empty-state compact-empty">No closed trades for this filter.</div>;
  }

  const width = 520;
  const height = 230;
  const padding = 28;
  const minX = Math.min(0, ...points.map((point) => point.x));
  const maxX = Math.max(1, ...points.map((point) => point.x));
  const minY = Math.min(0, ...points.map((point) => point.y));
  const maxY = Math.max(0, ...points.map((point) => point.y));
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  const zeroY = height - padding - ((0 - minY) / yRange) * (height - padding * 2);

  return (
    <div className="scatter-plot">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Holding period versus P&L">
        <line className="chart-zero-line" x1={padding} x2={width - padding} y1={zeroY} y2={zeroY} />
        {points.map((point, index) => {
          const x = padding + ((point.x - minX) / xRange) * (width - padding * 2);
          const y = height - padding - ((point.y - minY) / yRange) * (height - padding * 2);

          return (
            <circle
              className={point.tone === 'positive' ? 'scatter-dot scatter-dot-positive' : 'scatter-dot scatter-dot-negative'}
              cx={x}
              cy={y}
              key={`${point.label}-${index}`}
              r="4.5"
            >
              <title>{`${point.label}: ${point.x} day${point.x === 1 ? '' : 's'}, ${formatY(point.y)}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="chart-caption">
        <span>{minX}d</span>
        <span>{formatY(maxY)}</span>
        <span>{maxX}d</span>
      </div>
    </div>
  );
}
