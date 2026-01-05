import { RouterProvider } from "react-router";
import { useGateway } from "./lib/gateway";
import { router } from "./routes";
import { getLastSeenChannel, useAppliedTheme, useToken } from "./lib/cache";
import { fetchChannels, fetchEmojis, fetchMe } from "./lib/api";

export function Index() {
  useGateway();
  useAppliedTheme();

  async function init() {
    void fetchMe().catch(() => null);
    void fetchEmojis().catch(() => null);

    const channels = await fetchChannels();
    let channelId = getLastSeenChannel();
    if (!channelId || !channels.some((c) => c.id === channelId)) {
      channelId = channels[0]?.id;
    }

    const redirect = new URLSearchParams(globalThis.location.search).get(
      "redirect"
    );
    if (redirect?.startsWith("/")) {
      router.navigate(redirect);
      return;
    }

    const path = globalThis.location.pathname;
    const shouldAutoNav =
      path === "/" || path === "/login" || path === "/signup";

    if (shouldAutoNav) {
      router.navigate(`/channels/${channelId}`);
    }
  }

  const token = useToken();
  useEffect(() => {
    if (token) {
      init();
      return;
    }

    const path = globalThis.location.pathname;
    const isAuthRoute = path === "/login" || path === "/signup";
    const isInviteRoute = path.startsWith("/invites/");

    if (isAuthRoute || isInviteRoute) return;

    const redirect = `${path}${globalThis.location.search}${globalThis.location.hash}`;
    router.navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
  }, [token]);

  return <RouterProvider router={router} />;
}
