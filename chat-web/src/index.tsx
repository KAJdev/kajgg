import { RouterProvider } from "react-router";
import { useGateway } from "./lib/gateway";
import { router } from "./routes";
import { tokenCache } from "./lib/cache";
import { fetchChannels } from "./lib/api";

export function Index() {
  useGateway();

  const token = tokenCache();
  useEffect(() => {
    if (!token.token) {
      router.navigate("/login");
    } else {
      fetchChannels();
    }
  }, [token]);

  return <RouterProvider router={router} />;
}
