import { Button } from "@theme/Button";
import { Settings } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useIsChannelUnread, useUser } from "src/lib/cache";
import type { Channel as ChannelType } from "src/types/models/channel";

export function ListChannel({
  channel,
  active,
}: {
  channel: ChannelType;
  active: boolean;
}) {
  const self = useUser();
  const navigate = useNavigate();
  const ownsChannel = self?.id == channel.author_id;
  const isUnread = useIsChannelUnread(channel.id);
  return (
    <Link
      key={channel.id}
      className={classes(
        "w-full group text-left cursor-pointer flex items-center gap-2 whitespace-pre truncate text-ellipsis",
        active
          ? "text-primary bg-tertiary"
          : "text-secondary/70 hover:text-primary",
        isUnread && "text-primary"
      )}
      to={`/channels/${channel.id}`}
    >
      <span className="overflow-hidden text-ellipsis whitespace-[pre-wrap]">
        {active ? "> " : isUnread ? "! " : "  "}#{channel.name}
      </span>
      {ownsChannel && (
        <Button
          icon={Settings}
          className="ml-auto hidden group-hover:block"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            navigate(`/channels/${channel.id}?channelSettingsTab=channel`);
          }}
        />
      )}
    </Link>
  );
}
