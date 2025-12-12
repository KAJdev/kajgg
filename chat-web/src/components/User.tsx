import { useUser } from "src/lib/cache";
import { ListAuthor } from "./ListAuthor";
import { SettingsIcon } from "lucide-react";
import { Button } from "@theme/Button";
import { Modal } from "@theme/Modal";

function UserSettings() {
  return (
    <div>
      <h1>Settings</h1>
    </div>
  );
}

export function User() {
  const user = useUser();
  const [open, setOpen] = useState(false);

  if (!user) {
    return null;
  }

  return (
    <>
      <div className="border-t border-tertiary h-12 flex items-center justify-between">
        <ListAuthor author={user} />
        <Button icon={SettingsIcon} onClick={() => setOpen(true)} />
      </div>

      <Modal title="Settings" open={open} onClose={() => setOpen(false)}>
        <UserSettings />
      </Modal>
    </>
  );
}
