import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import {
  buildMessageMarkdownSanitizeSchema,
  getMessageMarkdownComponents,
} from "src/lib/messageMarkdownRegistry";

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

const baseComponents: Components = {
  a: MarkdownLink,
  strong: MarkdownStrong,
  em: MarkdownEm,
  del: MarkdownDel,
  u: MarkdownUnderline,
  pre: MarkdownPre,
  code: MarkdownCode,
};

export function MessageMarkdown({
  content,
}: Readonly<{
  content: string;
}>) {
  const custom = getMessageMarkdownComponents();

  return (
    <div className="wrap-break-word whitespace-pre-wrap">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, buildMessageMarkdownSanitizeSchema()],
        ]}
        components={{ ...baseComponents, ...custom } as unknown as Components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
