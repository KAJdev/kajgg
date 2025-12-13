export function ColorPicker({
  color,
  setColor,
}: {
  color: string;
  setColor: (color: string) => void;
}) {
  return (
    <input
      type="color"
      value={color}
      onChange={(e) => setColor(e.target.value)}
    />
  );
}
