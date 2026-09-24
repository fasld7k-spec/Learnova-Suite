export function ProgressBar({ value }: { value: number }) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      className="moe-progress dashboard-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedValue}
    >
      <div
        className="transition-[width] duration-500"
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}
