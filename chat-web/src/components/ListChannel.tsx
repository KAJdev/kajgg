import { Button } from "@theme/Button";
import { TrashIcon } from "lucide-react";
import { Link } from "react-router";
import { deleteChannel } from "src/lib/api";
import { useUser } from "src/lib/cache";
import type { Channel as ChannelType } from "src/types/models/channel";

export function ListChannel({
  channel,
  active,
}: {
  channel: ChannelType;
  active: boolean;
}) {
  const self = useUser();
  const ownsChannel = self?.id == channel.author_id;
  return (
    <Link
      key={channel.id}
      className={classes(
        "w-full group text-left transition cursor-pointer flex items-center gap-2 whitespace-pre truncate text-ellipsis",
        active ? "text-primary" : "text-secondary/70 hover:text-primary"
      )}
      to={`/channels/${channel.id}`}
    >
      <span className="overflow-hidden text-ellipsis whitespace-[pre-wrap]">
        {active ? "> " : "  "}#{channel.name}
      </span>
      {ownsChannel && (
        <Button
          icon={TrashIcon}
          className="ml-auto hidden group-hover:block"
          variant="danger"
          onClick={() => deleteChannel(channel.id)}
        />
      )}
    </Link>
  );
}
