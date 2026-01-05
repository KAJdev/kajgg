import type { Author } from "@schemas/index";
import { useTypingAuthors } from "src/lib/cache";
import { Username } from "./Username";

function Typing({ authors }: { authors: Author[] }) {
  const [ellipsis, setEllipsis] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setEllipsis((prev) => (prev === "..." ? "." : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  if (authors.length === 1) {
    return (
      <>
        <Username author={authors[0]} allowPlate={false} /> is typing
        {ellipsis}
      </>
    );
  }

  if (authors.length === 2) {
    return (
      <>
        <Username author={authors[0]} allowPlate={false} /> and{" "}
        <Username author={authors[1]} allowPlate={false} /> are typing{ellipsis}
      </>
    );
  }

  if (authors.length > 4) {
    return <>several people are typing{ellipsis}</>;
  }

  return (
    <>
      {authors
        .map((author) => (
          <Username key={author.id} author={author} allowPlate={false} />
        ))
        .join(", ")}{" "}
      are typing{ellipsis}
    </>
  );
}

export function TypingIndicator({ channelId }: { readonly channelId: string }) {
  const typingAuthors = useTypingAuthors(channelId);

  if (typingAuthors.length === 0) {
    return null;
  }

  return (
    <div className="bg-background border-x border-t border-tertiary px-1 text-secondary w-full absolute bottom-full">
      <Typing authors={typingAuthors} />
    </div>
  );
}
