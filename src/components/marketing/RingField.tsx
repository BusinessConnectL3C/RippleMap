/** Concentric-ring motif used as a calm decorative background wash. */
export function RingField({
  color = "var(--field-green)",
  opacity = 0.5,
}: {
  color?: string;
  opacity?: number;
}) {
  return (
    <svg width="100%" height="100%" className="absolute inset-0" style={{ opacity }} aria-hidden="true">
      {[60, 130, 210, 300, 400].map((r) => (
        <circle key={r} cx="50%" cy="50%" r={r} fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 6" />
      ))}
    </svg>
  );
}
