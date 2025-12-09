import { Button } from "@theme/Button";
import { useParams } from "react-router";
import { Message } from "src/components/Message";
import { Page } from "src/layout/page";
import { createMessage, fetchMessages } from "src/lib/api";
import { cache, useChannel, useChannelMessages } from "src/lib/cache";

export function Channel() {
  const { channelId } = useParams();
  const [content, setContent] = useState("");

  const messageMap = useChannelMessages(channelId ?? "");
  const channel = useChannel(channelId ?? "");

  console.log(channel, messageMap, cache.getState());

  useEffect(() => {
    if (channelId) {
      fetchMessages(channelId);
    }
  }, [channelId]);

  const messages = Object.values(messageMap ?? {}).sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <Page>
      <h1>#{channel?.name}</h1>
      <p>{channel?.topic}</p>
      <div className="flex flex-col items-center justify-center">
        {messages?.map((message) => (
          <Message key={message.id} message={message} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder={`Message #${channel?.id}`}
          value={content}
          onChange={(e) => setContent((e.target as HTMLInputElement).value)}
        />
        <Button
          onClick={() =>
            createMessage(channelId ?? "", content).then(() => setContent(""))
          }
        >
          Send
        </Button>
      </div>
    </Page>
  );
}
