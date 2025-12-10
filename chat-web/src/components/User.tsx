import { useUser } from "src/lib/cache";
import { ListAuthor } from "./ListAuthor";

export function User() {
  const user = useUser();

  if (!user) {
    return null;
  }

  return (
    <div className="border-t border-neutral-800 h-12 flex items-center">
      <ListAuthor author={user} />
    </div>
  );
}
