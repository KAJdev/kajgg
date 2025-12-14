import { Children } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import Twemoji from "react-twemoji";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import {
  buildMessageMarkdownSanitizeSchema,
  getMessageMarkdownComponents,
} from "src/lib/messageMarkdownRegistry";
import { remarkMinecraftFormatting } from "src/lib/remarkMinecraftFormatting";
import { remarkEmojis } from "src/lib/remarkEmojis";
import { isEmojiOnlyMessage } from "src/lib/emojiOnly";
import "src/lib/minecraftSpan";
import "src/lib/emojiMarkdown";

function MarkdownLink({
  children,
  ...props
}: Readonly<
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }
>) {
  return (
    <a
      {...props}
      target="_blank"
      rel="noreferrer"
      className="text-blue-400 hover:underline wrap-break-word"
    >
      {children}
    </a>
  );
}

function MarkdownStrong(props: Readonly<React.HTMLAttributes<HTMLElement>>) {
  return <strong {...props} className="font-semibold" />;
}

function MarkdownEm(props: Readonly<React.HTMLAttributes<HTMLElement>>) {
  return <em {...props} className="italic" />;
}

function MarkdownDel(props: Readonly<React.HTMLAttributes<HTMLElement>>) {
  return <del {...props} className="line-through" />;
}

function MarkdownUnderline(props: Readonly<React.HTMLAttributes<HTMLElement>>) {
  return <u {...props} className="underline" />;
}

function MarkdownPre(props: Readonly<React.HTMLAttributes<HTMLPreElement>>) {
  return (
    <pre
      {...props}
      className="overflow-x-auto whitespace-pre border border-tertiary/50 bg-black/20 p-3 leading-5"
    />
  );
}

function MarkdownParagraph(
  props: Readonly<React.HTMLAttributes<HTMLParagraphElement>>
) {
  return <div {...props} />;
}

function MarkdownCode({
  className,
  children,
  ...props
}: Readonly<React.HTMLAttributes<HTMLElement>>) {
  return (
    <code
      {...props}
      className={classes(
        "whitespace-pre",
        "bg-black/30 px-1 py-0.5",
        className
      )}
    >
      {children}
    </code>
  );
}

function MarkdownBlockquote({
  children,
  ...props
}: Readonly<React.HTMLAttributes<HTMLQuoteElement>>) {
  const kids = Children.toArray(children);

  let start = 0;
  let end = kids.length;

  while (start < end) {
    const k = kids[start];
    if (typeof k !== "string" || k.trim().length !== 0) break;
    start++;
  }

  while (end > start) {
    const k = kids[end - 1];
    if (typeof k !== "string" || k.trim().length !== 0) break;
    end--;
  }

  return (
    <blockquote
      {...props}
      className="border-l-4 border-tertiary/50 pl-3 py-1 my-0 bg-tertiary/20 pr-2"
    >
      {kids.slice(start, end)}
    </blockquote>
  );
}

const baseComponents: Components = {
  a: MarkdownLink,
  strong: MarkdownStrong,
  em: MarkdownEm,
  del: MarkdownDel,
  u: MarkdownUnderline,
  pre: MarkdownPre,
  code: MarkdownCode,
  blockquote: MarkdownBlockquote,
  p: MarkdownParagraph,
};

export function MessageMarkdown({
  content,
}: Readonly<{
  content: string;
}>) {
  const custom = getMessageMarkdownComponents();
  const emojiOnly = isEmojiOnlyMessage(content);

  const emojiBase =
    "[&_.twemoji]:inline-block [&_.twemoji]:align-[-2px] [&_.custom-emoji]:inline-block [&_.custom-emoji]:align-[-2px]";
  const emojiSize = emojiOnly
    ? "[&_.twemoji]:w-12 [&_.twemoji]:h-12 [&_.custom-emoji]:w-12 [&_.custom-emoji]:h-12"
    : "[&_.twemoji]:w-4 [&_.twemoji]:h-4 [&_.custom-emoji]:w-4 [&_.custom-emoji]:h-4";

  return (
    <Twemoji
      tag="div"
      options={{ className: "twemoji" }}
      className={classes(
        "wrap-break-word whitespace-pre-wrap",
        emojiBase,
        emojiSize,
        emojiOnly && "leading-none"
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMinecraftFormatting, remarkEmojis]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, buildMessageMarkdownSanitizeSchema()],
        ]}
        components={{ ...baseComponents, ...custom } as unknown as Components}
      >
        {content}
      </ReactMarkdown>
    </Twemoji>
  );
}
