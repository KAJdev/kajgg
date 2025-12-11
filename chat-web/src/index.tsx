import { RouterProvider } from "react-router";
import { useGateway } from "./lib/gateway";
import { router } from "./routes";
import { useToken } from "./lib/cache";
import { fetchChannels, fetchMe } from "./lib/api";

export function Index() {
  useGateway();

  async function init() {
    fetchMe();

    const channels = await fetchChannels();
    const channelId = channels[0]?.id;
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
