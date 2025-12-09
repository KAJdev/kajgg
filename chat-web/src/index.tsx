import { RouterProvider } from "react-router";
import { useGateway } from "./lib/gateway";
import { router } from "./routes";
import { useToken } from "./lib/cache";
import { createChannel, fetchChannels, fetchMe } from "./lib/api";

export function Index() {
  useGateway();

  async function init() {
    fetchMe();

    const channels = await fetchChannels();
    let channelId = channels[0]?.id;
    if (channels.length === 0) {
      const channel = await createChannel("general", "General channel", false);
      channelId = channel.id;
    }

    router.navigate(`/channels/${channelId}`);
  }

  const token = useToken();
  useEffect(() => {
    if (!token) {
      router.navigate("/login");
    } else {
      init();
    }
  }, [token]);

  return <RouterProvider router={router} />;
}
