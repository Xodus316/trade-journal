interface LineChartProps {
  points: Array<{ x: string; y: number }>;
  formatY?: (value: number) => string;
}

export function LineChart({ points, formatY = (value) => String(value) }: LineChartProps) {
  if (points.length === 0) {
    return <div className="empty-state compact-empty">No chart data yet.</div>;
  }

  const width = 720;
  const height = 220;
  const padding = 28;
  const values = points.map((point) => point.y);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  const coordinates = points.map((point, index) => {
    const x = padding + (index / Math.max(1, points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.y - min) / range) * (height - padding * 2);
    return { ...point, x, y };
  });

  const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const zeroY = height - padding - ((0 - min) / range) * (height - padding * 2);
  const lastPoint = points.at(-1);

  return (
    <div className="line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="P&L line chart">
        <line className="chart-zero-line" x1={padding} x2={width - padding} y1={zeroY} y2={zeroY} />
        <path className="chart-line" d={path} />
      </svg>
      <div className="chart-caption">
        <span>{points[0].x}</span>
        <strong>{lastPoint ? formatY(lastPoint.y) : ''}</strong>
        <span>{lastPoint?.x}</span>
      </div>
    </div>
  );
}
