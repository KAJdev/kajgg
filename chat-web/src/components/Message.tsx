import { useAuthor } from "src/lib/cache";
import type { Message as MessageType } from "src/types/models/message";

export function Message({ message }: { message: MessageType }) {
  const author = useAuthor(message.author_id);
  return (
    <div className={classes("flex flex-col")}>
      <div>{author?.username}</div>
      <div>{message.content}</div>
    </div>
  );
}
