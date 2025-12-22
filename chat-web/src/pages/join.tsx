/* eslint-disable react-hooks/set-state-in-effect */
import type { Author } from "@schemas/index";
import type { Channel } from "@schemas/models/channel";
import type { ChannelInvite } from "@schemas/models/channelinvite";
import { Loader2Icon } from "lucide-react";
import { Navigate, useParams } from "react-router";
import { fetchInvite } from "src/lib/api";

export function Join() {
  const { code } = useParams();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    invite: ChannelInvite;
    channel: Channel;
    author: Author;
  } | null>(null);

  useEffect(() => {
    if (!code) return;
    fetchInvite(code)
      .then(({ invite, channel, author }) => {
        setResult({ invite, channel, author });
      })
      .catch((error) => {
        setError(error.message);
      });
  }, [code]);

  if (!code) {
    return <Navigate to="/" />;
  }

  const loading = !result && !error;

  return (
    <div className="h-dvh w-dvw flex items-center justify-center">
      <div className="flex flex-col gap-4">
        {loading ? (
          <Loader2Icon className="h-4 w-4 animate-spin" size={16} />
        ) : (
          <div>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold">{result?.channel.name}</h1>
              <p className="text-sm text-gray-500">{result?.channel.topic}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
