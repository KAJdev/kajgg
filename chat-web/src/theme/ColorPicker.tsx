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
      className="cursor-pointer h-10 w-24"
      value={color}
      onChange={(e) => setColor(e.target.value)}
    />
  );
}
