import type { Author } from "@schemas/index";
import type { Channel } from "@schemas/models/channel";
import type { ChannelInvite } from "@schemas/models/channelinvite";
import { Button } from "@theme/Button";
import { Loader2Icon } from "lucide-react";
import { Link } from "react-router";
import { fetchChannels, fetchInvite, joinInvite } from "src/lib/api";
import {
  cache,
  getLastSeenChannel,
  setLastSeenChannel,
  useToken,
} from "src/lib/cache";
import { router } from "src/routes";

type InviteResult = {
  invite: ChannelInvite;
  channel: Channel;
  author: Author;
};

const invitePreviewCache = new Map<string, InviteResult>();

export function InviteCard({ code }: { code: string }) {
  const token = useToken();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(
    invitePreviewCache.get(code) ?? null
  );
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const cached = invitePreviewCache.get(code);
    if (cached) {
      setResult(cached);
      return;
    }

    fetchInvite(code)
      .then((data) => {
        if (cancelled) return;
        invitePreviewCache.set(code, data);
        setResult(data);
      })
      .catch((e) => {
        if (cancelled) return;
        setError((e as Error).message || "failed to fetch invite");
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  const loading = !result && !error;

  const link = `/invites/${code}`;

  const alreadyJoined = !!cache.getState().channels[result?.channel?.id ?? ""];

  return (
    <div
      className={classes(
        "border border-tertiary/30 bg-black/20 p-3 flex flex-col gap-2"
      )}
    >
      {loading && (
        <div className="flex items-center gap-2 text-secondary/50">
          <Loader2Icon className="h-4 w-4 animate-spin" size={16} />
          <span>loading...</span>
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-2">
          <p className="text-red-400">{error}</p>
          {!token && (
            <Button
              onClick={() =>
                router.navigate(`/login?redirect=${encodeURIComponent(link)}`)
              }
            >
              login
            </Button>
          )}
        </div>
      )}

      {result && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="font-bold truncate">#{result.channel.name}</div>
              {result.channel.topic && (
                <div className="text-secondary/60 truncate">
                  {result.channel.topic}
                </div>
              )}
            </div>
          </div>

          {!token ? (
            <Button
              onClick={() =>
                router.navigate(`/login?redirect=${encodeURIComponent(link)}`)
              }
            >
              login to join
            </Button>
          ) : alreadyJoined ? (
            <Link className="w-full" to={`/channels/${result.channel.id}`}>
              <Button className="w-full">view #{result.channel.name}</Button>
            </Link>
          ) : (
            <Button
              loading={joining}
              onClick={async () => {
                if (joining) return;
                setJoining(true);
                setError(null);
                try {
                  await joinInvite(code);
                  setLastSeenChannel(result.channel.id);
                  router.navigate(`/channels/${result.channel.id}`);

                  // best-effort: refresh channels in background so sidebar updates
                  void fetchChannels()
                    .then((channels) => {
                      const last = getLastSeenChannel();
                      if (!last && channels[0]?.id) {
                        setLastSeenChannel(channels[0].id);
                      }
                    })
                    .catch(() => null);
                } catch (e) {
                  setError((e as Error).message || "failed to join");
                } finally {
                  setJoining(false);
                }
              }}
            >
              join
            </Button>
          )}
        </>
      )}
    </div>
  );
}
