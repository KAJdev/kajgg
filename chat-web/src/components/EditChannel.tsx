import { useChannel } from "src/lib/cache";
import { Button } from "@theme/Button";
import { Modal } from "@theme/Modal";
import { useParams, useSearchParams } from "react-router";
import { Tab, Tabs } from "@theme/Tabs";
import { Input } from "@theme/Input";
import { Label } from "@theme/Label";
import type { Webhook as WebhookType } from "src/types/models/webhook";
import { ColorPicker } from "@theme/ColorPicker";
import { API_URL, type ApiError } from "src/lib/request";
import type { Channel as ChannelType } from "src/types/models/channel";
import {
  createWebhook,
  deleteChannel,
  deleteWebhook,
  editChannel,
  fetchWebhooks,
  updateWebhook,
  useWebhooks,
} from "src/lib/api";
import { Loader2Icon } from "lucide-react";
import { router } from "src/routes";
import { Switch } from "@theme/Switch";

function ChannelSettings({ channel }: { channel: ChannelType }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [form, setForm] = useState<Partial<ChannelType>>({});

  async function handleSave() {
    setLoading(true);
    const [, error] = await editChannel(channel.id, form);
    if (error) {
      setError(error);
    } else {
      setForm({});
    }
    setLoading(false);
  }

  if (!channel) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Channel Name</Label>
        <Input
          type="text"
          value={form.name ?? channel.name}
          onChange={(name: string) =>
            setForm({
              ...form,
              name: name.replace(/\s+/g, "-").toLowerCase(),
            })
          }
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Topic</Label>
        <Input
          type="text"
          value={form.topic ?? channel.topic ?? ""}
          onChange={(topic: string) => setForm({ ...form, topic })}
          placeholder="Tell us about the channel..."
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
          checked={form.private ?? channel.private ?? false}
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
        <Button
          onClick={handleSave}
          disabled={Object.keys(form).length === 0}
          loading={loading}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function WebhookItem({ webhook }: { webhook: WebhookType }) {
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [name, setName] = useState(webhook.name);
  const [color, setColor] = useState(webhook.color);
  return (
    <div className="flex flex-col gap-2 border border-tertiary/30 p-2 bg-tertiary/10">
      <div className="flex items-center gap-2 justify-between">
        <div className="flex flex-col gap-2 w-full">
          <Label>Name</Label>
          <Input
            className="text-primary w-full"
            value={name}
            maxLength={32}
            disabled={updateLoading}
            onChange={setName}
          />
        </div>
        <div className="flex flex-col gap-2 w-24">
          <Label>Color</Label>
          <ColorPicker color={color} setColor={setColor} />
        </div>
      </div>

      <div className="flex items-center gap-2 justify-between pt-4 border-t border-tertiary/30">
        <Button
          onClick={() =>
            navigator.clipboard.writeText(
              `${API_URL}/api/v1/webhooks/${webhook.channel_id}/${webhook.id}/${webhook.secret}`
            )
          }
        >
          copy url
        </Button>

        <div className="flex items-center gap-6">
          <Button
            loading={deleteLoading}
            variant="danger"
            onClick={async () => {
              setDeleteLoading(true);
              await deleteWebhook(webhook.channel_id, webhook.id);
              setDeleteLoading(false);
            }}
          >
            delete
          </Button>
          <Button
            loading={updateLoading}
            disabled={name === webhook.name && color === webhook.color}
            onClick={async () => {
              setUpdateLoading(true);
              await updateWebhook(webhook.channel_id, webhook.id, {
                name: name === webhook.name ? undefined : name,
                color: color === webhook.color ? undefined : color,
              }).catch(() => {
                setUpdateLoading(false);
              });
            }}
          >
            save
          </Button>
        </div>
      </div>
    </div>
  );
}

function WebhooksSettings({ channelId }: { channelId: string }) {
  const webhooks = useWebhooks(channelId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchWebhooks(channelId).then(() => setLoading(false));
  }, [channelId]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-secondary/50">
        webhooks can send messages directly to this channel
      </p>
      <div>
        <Button onClick={() => createWebhook(channelId, "new_webhook")}>
          Create Webhook
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-tertiary/30 pt-4">
        {webhooks?.length === 0 && !loading && (
          <div className="flex items-center gap-2 text-secondary/50">
            <p>no webhooks yet. Try creating one!</p>
          </div>
        )}
        {loading && !webhooks && (
          <div className="flex items-center gap-2 text-secondary/50">
            <Loader2Icon className="w-4 h-4 animate-spin" />
          </div>
        )}
        {webhooks?.map((webhook) => (
          <WebhookItem key={webhook.id} webhook={webhook} />
        ))}
      </div>
    </div>
  );
}

function MembersSettings() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-secondary/50">members can join this channel</p>
    </div>
  );
}

function DangerZoneSettings({ channelId }: { channelId: string }) {
  const [deleteLoading, setDeleteLoading] = useState(false);
  return (
    <div className="flex gap-6 border border-red-500/30 p-2 justify-between">
      <p>delete this channel</p>
      <Button
        variant="danger"
        onClick={async () => {
          setDeleteLoading(true);
          await deleteChannel(channelId);
          router.navigate(`/channels`);
          setDeleteLoading(false);
        }}
        loading={deleteLoading}
      >
        Delete Channel
      </Button>
    </div>
  );
}

export function EditChannel() {
  const { channelId = "" } = useParams();
  const channel = useChannel(channelId);
  const [searchParams, setSearchParams] = useSearchParams();
  const channelSettingsTab = searchParams.get("channelSettingsTab");

  if (!channel) {
    return null;
  }

  return (
    <Modal
      title={`Edit #${channel.name}`}
      open={Boolean(channelSettingsTab)}
      onClose={() => setSearchParams({})}
    >
      <div className="flex flex-col gap-8">
        <Tabs
          value={channelSettingsTab ?? ""}
          onChange={(value) => setSearchParams({ channelSettingsTab: value })}
        >
          <Tab name="Channel" value="channel" />
          <Tab name="Webhooks" value="webhooks" />
          <Tab name="Members" value="members" />
          <Tab
            name="Danger Zone"
            value="danger-zone"
            className="text-red-500"
          />
        </Tabs>
        {channelSettingsTab === "channel" && (
          <ChannelSettings channel={channel} />
        )}
        {channelSettingsTab === "webhooks" && (
          <WebhooksSettings channelId={channelId} />
        )}
        {channelSettingsTab === "members" && <MembersSettings />}
        {channelSettingsTab === "danger-zone" && (
          <DangerZoneSettings channelId={channelId} />
        )}
      </div>
    </Modal>
  );
}
