import { Button } from "@theme/Button";
import { Input } from "@theme/Input";
import { Label } from "@theme/Label";
import { Switch } from "@theme/Switch";
import { createChannel } from "src/lib/api";
import type { ApiError } from "src/lib/request";
import type { Channel as ChannelType } from "src/types/models/channel";

type Form = {
  name: string;
  topic: string;
  private: boolean;
};

export function CreateChannel({
  onCreated,
  isPrivate = false,
}: {
  onCreated?: (channel: ChannelType) => void;
  isPrivate?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [form, setForm] = useState<Partial<Form>>({});

  const name = form.name ?? "";
  const topic = form.topic ?? "";
  const canCreate = name.trim().length > 0;

  async function handleCreate() {
    if (!canCreate) {
      setError({ message: "name is required", status: 400 });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const channel = await createChannel(name.trim(), topic.trim(), isPrivate);
      setForm({});
      onCreated?.(channel);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Name</Label>
        <Input
          type="text"
          value={name}
          onChange={(name: string) => {
            setError(null);
            setForm({ ...form, name: name.replace(/\s+/g, "-").toLowerCase() });
          }}
          placeholder="general"
          maxLength={100}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Topic</Label>
        <Input
          type="text"
          value={topic}
          onChange={(topic: string) => {
            setError(null);
            setForm({ ...form, topic });
          }}
          placeholder="what's this channel for?"
          maxLength={1000}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1 w-2/3">
          <Label>Private Channel</Label>
          <p className="text-secondary/60 text-sm">
            Private channels are only visible to you and the people you invite.
          </p>
        </div>
        <Switch
          checked={form.private ?? true}
          onChange={(isPrivate: boolean) =>
            setForm({ ...form, private: isPrivate })
          }
        />
      </div>

      <div className="flex items-center gap-2 justify-between pt-4">
        {error ? (
          <span className="text-red-500">{error.message}</span>
        ) : (
          <div />
        )}
        <Button onClick={handleCreate} disabled={!canCreate} loading={loading}>
          Create
        </Button>
      </div>
    </div>
  );
}
