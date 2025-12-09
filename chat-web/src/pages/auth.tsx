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
    <div className="flex flex-col items-center justify-center h-screen">
      <h1>Welcome to the chat</h1>
      <Input
        type="text"
        placeholder="Username"
        value={username}
        onChange={setUsername}
      />
      {mode === "signup" && (
        <Input
          type="text"
          placeholder="Email"
          value={email}
          onChange={setEmail}
        />
      )}
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={setPassword}
      />
      <Button onClick={handleSubmit}>Submit</Button>

      {mode === "login" && <Link to="/signup">Sign up</Link>}
      {mode === "signup" && <Link to="/login">Login</Link>}
    </div>
  );
}
