import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
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
import { MessageMarkdownContext } from "src/lib/messageMarkdownContext";
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

function MarkdownBlockquote(
  props: Readonly<React.HTMLAttributes<HTMLQuoteElement>>
) {
  return (
    <blockquote
      {...props}
      className="border-l-4 border-tertiary/50 pl-3 leading-[8px] bg-tertiary/20 pr-2"
    />
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
  const ctx = useMemo(() => ({ emojiOnly }), [emojiOnly]);

  return (
    <MessageMarkdownContext.Provider value={ctx}>
      <div
        className={classes(
          "wrap-break-word whitespace-pre-wrap",
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
      </div>
    </MessageMarkdownContext.Provider>
  );
}
