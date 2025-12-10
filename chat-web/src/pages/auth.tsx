import { Input } from "@theme/Input";
import { Link } from "react-router";
import { login, signup } from "src/lib/api";
import { Button } from "@theme/Button";

export function Auth({ mode }: { mode: "login" | "signup" }) {
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  async function handleSubmit() {
    if (mode === "login") {
      await login(username, password);
    } else {
      await signup(username, password, email);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-dvh gap-4">
      <h1>kaj.gg</h1>
      <Input
        type="text"
        placeholder="Username"
        value={username}
        onChange={setUsername}
        className="w-64"
      />
      {mode === "signup" && (
        <Input
          type="text"
          placeholder="Email"
          value={email}
          onChange={setEmail}
          className="w-64"
        />
      )}
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={setPassword}
        className="w-64"
      />
      <div className="flex items-center gap-2 justify-between w-64">
        <Button onClick={handleSubmit}>
          {mode === "login" ? "Login" : "Sign up"}
        </Button>

        <div className="opacity-35 cursor-pointer hover:opacity-100 transition-opacity">
          Or {mode === "login" && <Link to="/signup">sign up</Link>}
          {mode === "signup" && <Link to="/login">login</Link>}
        </div>
      </div>
    </div>
  );
}
