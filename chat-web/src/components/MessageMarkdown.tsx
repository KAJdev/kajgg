import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import {
  buildMessageMarkdownSanitizeSchema,
  getMessageMarkdownComponents,
} from "src/lib/messageMarkdownRegistry";

export function MessageMarkdown({ content }: { content: string }) {
  const custom = getMessageMarkdownComponents();

  const baseComponents: Components = {
    a: (props) => (
      <a
        {...props}
        target="_blank"
        rel="noreferrer"
        className="text-blue-400 hover:underline break-words"
      />
    ),
    p: (props) => <p {...props} className="whitespace-pre-wrap" />,
    strong: (props) => <strong {...props} className="font-semibold" />,
    em: (props) => <em {...props} className="italic" />,
    del: (props) => <del {...props} className="line-through" />,
    u: (props) => <u {...props} className="underline" />,
  };

  return (
    <div className="wrap-break-word whitespace-pre-wrap">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
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
