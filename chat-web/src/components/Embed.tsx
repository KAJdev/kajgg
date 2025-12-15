import type { Embed } from "@schemas/models/embed";
import { MessageMarkdown } from "./MessageMarkdown";
import type { CSSProperties } from "react";
import { useUserSettings } from "src/lib/cache";
import { MessageFile } from "./Message";

const mediaOnlyFields = {
  image_url: ["image", "png"],
  video_url: ["video", "mp4"],
  audio_url: ["audio", "mpeg"],
} as const;

const MEDIA_PROXY_URL = import.meta.env.VITE_MEDIA_PROXY;

export function Embed({ embed }: { embed: Embed }) {
  const { theme } = useUserSettings();

  const singleMediaField =
    Object.values(embed).filter(Boolean).length === 1
      ? Object.entries(embed).find(
          ([key, value]) => value && Object.keys(mediaOnlyFields).includes(key)
        )
      : null;

  // if we only have an image url, we can just show the image
  if (singleMediaField) {
    const [key, url] = singleMediaField;
    const ext =
      url?.split(".").length > 2
        ? url?.split(".").pop()?.toLowerCase()
        : mediaOnlyFields[key as keyof typeof mediaOnlyFields][1];
    const mime_type = `${
      mediaOnlyFields[key as keyof typeof mediaOnlyFields][0]
    }/${ext}`;

    return (
      <MessageFile
        file={{
          id: url,
          name:
            embed.title ??
            `${mediaOnlyFields[key as keyof typeof mediaOnlyFields][1]}.${
              ext ?? mediaOnlyFields[key as keyof typeof mediaOnlyFields][1]
            }`,
          url: `${MEDIA_PROXY_URL}/${url}`,
          mime_type,
          size: 0,
        }}
      />
    );
  }

  const content = (
    <div
      className={classes(
        "flex flex-col gap-2 max-w-[40rem] border p-2 border-[var(--border-color)] bg-[var(--background-color)] group",
        embed.url && "hover:bg-[var(--active-background-color)]"
      )}
      style={
        {
          ["--border-color"]: embed.color
            ? embed.color + "80"
            : theme.colors.tertiary + "80",
          ["--background-color"]: embed.color
            ? embed.color + "10"
            : theme.colors.tertiary + "10",
          ["--active-background-color"]: embed.color
            ? embed.color + "20"
            : theme.colors.tertiary + "20",
        } as CSSProperties
      }
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          {embed.title && (
            <h3
              className={classes(
                "font-medium text-primary",
                embed.url && "group-hover:underline"
              )}
            >
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
      </div>
      {embed.image_url && (
        <img
          src={embed.image_url}
          alt={embed.title}
          className="max-h-48 object-cover"
        />
      )}
    </div>
  );

  if (embed.url) {
    return (
      <a href={embed.url} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return content;
}
