import type { Author } from "@schemas/index";
import { useTypingAuthors } from "src/lib/cache";

function typingString(authors: Author[]) {
  const usernames = authors.map((author) => author.username);

  if (usernames.length === 1) {
    return `${usernames[0]} is typing...`;
  }

  if (usernames.length === 2) {
    return `${usernames[0]} and ${usernames[1]} are typing...`;
  }

  if (usernames.length > 4) {
    return `several people are typing...`;
  }

  return `${usernames.join(", ")} are typing...`;
}

export function TypingIndicator({ channelId }: { readonly channelId: string }) {
  const typingAuthors = useTypingAuthors(channelId);

  if (typingAuthors.length === 0) {
    return null;
  }

  return (
    <p className="bg-neutral-800 px-1 text-neutral-400 w-fit">
      <p className="animate-pulse">{typingString(typingAuthors)}</p>
    </p>
  );
}
