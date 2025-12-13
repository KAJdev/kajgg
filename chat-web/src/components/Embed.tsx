import type { Embed } from "@schemas/models/embed";

export function Embed({ embed }: { embed: Embed }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <img src={embed.image_url} alt={embed.title} className="w-10 h-10" />
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">{embed.title}</h3>
          <p className="text-sm text-neutral-400">{embed.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-neutral-400">{embed.footer}</p>
        </div>
      </div>
    </div>
  );
}
