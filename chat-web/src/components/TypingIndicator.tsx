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

  const usernames = authors.map((author) => author.username);

  if (usernames.length === 1) {
    return (
      <>
        <Username id={authors[0].id} username={authors[0].username} /> is typing
        {ellipsis}
      </>
    );
  }

  if (usernames.length === 2) {
    return (
      <>
        <Username id={authors[0].id} username={authors[0].username} /> and{" "}
        <Username id={authors[1].id} username={authors[1].username} /> are
        typing{ellipsis}
      </>
    );
  }

  if (usernames.length > 4) {
    return <>several people are typing{ellipsis}</>;
  }

  return (
    <>
      {usernames
        .map((username) => (
          <Username key={username} id={username} username={username} />
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
    <div className="bg-tertiary px-1 text-secondary w-full">
      <Typing authors={typingAuthors} />
    </div>
  );
}
