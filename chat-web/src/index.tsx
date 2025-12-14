import { RouterProvider } from "react-router";
import { useGateway } from "./lib/gateway";
import { router } from "./routes";
import { getLastSeenChannel, useAppliedTheme, useToken } from "./lib/cache";
import { fetchChannels, fetchEmojis, fetchMe } from "./lib/api";

export function Index() {
  useGateway();
  useAppliedTheme();

  async function init() {
    fetchMe();
    fetchEmojis();

    const channels = await fetchChannels();
    let channelId = getLastSeenChannel();
    if (!channelId || !channels.some((c) => c.id === channelId)) {
      channelId = channels[0]?.id;
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
