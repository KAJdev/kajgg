import { createBrowserRouter } from "react-router";
import { Login } from "./pages/login";
import { Signup } from "./pages/signup";
import { Channel } from "./pages/channel";
import { Settings } from "./pages/settings";
import { Join } from "./pages/join";

export const router = createBrowserRouter([
  {
    path: "/channels/:channelId",
    Component: Channel,
  },
  {
    path: "/invites/:code",
    Component: Join,
  },
  {
    path: "/settings",
    Component: Settings,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/signup",
    Component: Signup,
  },
  {
    path: "/",
    Component: Signup,
    index: true,
  },
]);
