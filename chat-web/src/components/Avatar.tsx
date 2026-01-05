import { useMemo, useState } from "react";
import { getColor } from "src/lib/utils";

export function Avatar({
  id,
  username,
  avatarUrl,
  color,
  size = 28,
  className,
}: Readonly<{
  id: string;
  username: string;
  avatarUrl?: string | null;
  color?: string;
  size?: number;
  className?: string;
}>) {
  const [failed, setFailed] = useState(false);
  const bg = useMemo(() => {
    return color ?? getColor(id);
  }, [id, color]);

  const initial = (username?.trim()?.[0] ?? "?").toUpperCase();
  const showImg = !!avatarUrl && !failed;

  return (
    <div
      className={classes("shrink-0 select-none", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: showImg ? "transparent" : bg,
      }}
      title={username}
    >
      {showImg ? (
        <img
          src={avatarUrl}
          alt={username}
          className="w-full h-full object-cover"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-black/70 font-semibold"
          style={{ fontSize: Math.max(10, Math.floor(size * 0.45)) }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}
