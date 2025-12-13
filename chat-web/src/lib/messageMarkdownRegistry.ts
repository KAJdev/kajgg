import type React from "react";
import { defaultSchema } from "rehype-sanitize";
import type { Options as Schema } from "rehype-sanitize";

export type MessageMarkdownComponent = React.ComponentType<
  Record<string, unknown> & { children?: React.ReactNode }
>;

// tiny registry so you can add new components without touching the renderer
// usage:
// registerMessageMarkdownComponent("badge", Badge, ["text", "variant"])
const registry: Record<string, MessageMarkdownComponent> = {};
const registryAttrs: Record<string, string[]> = {};

export function registerMessageMarkdownComponent(
  tag: string,
  component: MessageMarkdownComponent,
  allowedAttrs: string[] = []
) {
  // keep it lowercase bc html parsing will lowercase tags anyway
  const key = tag.toLowerCase();
  registry[key] = component;
  registryAttrs[key] = allowedAttrs;
}

export function getMessageMarkdownComponents(): Record<
  string,
  MessageMarkdownComponent
> {
  return registry;
}

export function buildMessageMarkdownSanitizeSchema(): Schema {
  const customTags = Object.keys(registry);

  // defaultSchema is pretty strict, we just extend it a bit
  const tagNames = Array.from(
    new Set([...(defaultSchema.tagNames ?? []), "u", ...customTags])
  );

  const attributes: NonNullable<Schema["attributes"]> = {
    ...(defaultSchema.attributes ?? {}),
    // allow underline (markdown doesnt have it, so we do <u>text</u>)
    u: [],
  };

  for (const tag of customTags) {
    attributes[tag] = registryAttrs[tag] ?? [];
  }

  return {
    ...defaultSchema,
    tagNames,
    attributes,
  } as Schema;
}
