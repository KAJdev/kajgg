import type { Embed } from "@schemas/models/embed";
import { MessageMarkdown } from "./MessageMarkdown";

export function Embed({ embed }: { embed: Embed }) {
  return (
    <div
      className="flex flex-col gap-2 max-w-[40rem] border p-2 border-tertiary/50 bg-tertiary/10"
      style={{
        borderColor: embed.color + "80",
        backgroundColor: embed.color + "10",
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          {embed.title && (
            <h3 className="font-medium text-primary">
              <MessageMarkdown content={embed.title} />
            </h3>
          )}
          {embed.description && (
            <div className="text-secondary">
              <MessageMarkdown content={embed.description} />
            </div>
          )}
          {embed.footer && (
            <div className="text-secondary/50">
              <MessageMarkdown content={embed.footer} />
            </div>
          )}
        </div>

        {embed.image_url && (
          <img
            src={embed.image_url}
            alt={embed.title}
            className="max-w-48 max-h-48 object-cover"
          />
        )}
      </div>
    </div>
  );
}
