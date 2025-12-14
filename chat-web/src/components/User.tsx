import { useEmojis, useUser, useUserSettings } from "src/lib/cache";
import { ListAuthor } from "./ListAuthor";
import { RefreshCcwIcon, SettingsIcon, XIcon } from "lucide-react";
import { Button } from "@theme/Button";
import { Modal } from "@theme/Modal";
import { useSearchParams } from "react-router";
import { Tab, Tabs } from "@theme/Tabs";
import { Input } from "@theme/Input";
import { AuthorPlate } from "./AuthorPlate";
import { Select, Option } from "@theme/Select";
import { Label } from "@theme/Label";
import { Status as StatusType } from "src/types/models/status";
import type { User as UserType } from "src/types/models/user";
import { ColorPicker } from "@theme/ColorPicker";
import { createEmoji, deleteEmoji, updateEmoji, updateUser } from "src/lib/api";
import type { ApiError } from "src/lib/request";
import { getColor } from "src/lib/utils";
import { defaultTheme } from "src/lib/cache";
import { Emoji } from "./Emoji";

function UserSettings() {
  const user = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [form, setForm] = useState<Partial<UserType>>({});

  async function handleSave() {
    setLoading(true);
    const [, error] = await updateUser(form);
    if (error) {
      setError(error);
    } else {
      setForm({});
    }
    setLoading(false);
  }

  if (!user) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label>Username</Label>
          <Input
            type="text"
            value={form.username ?? user.username}
            onChange={(username: string) => setForm({ ...form, username })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Bio</Label>
          <Input
            type="text"
            value={form.bio ?? user.bio ?? ""}
            onChange={(bio: string) => setForm({ ...form, bio })}
            placeholder="Tell us about yourself..."
            maxLength={1000}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Default Status</Label>
          <Select<StatusType>
            value={
              form.default_status ?? user.default_status ?? StatusType.ONLINE
            }
            onChange={(value) => setForm({ ...form, default_status: value })}
          >
            <Option value={StatusType.ONLINE} label="Online" />
            <Option value={StatusType.AWAY} label="Away" />
            <Option value={StatusType.DO_NOT_DISTURB} label="Do Not Disturb" />
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-2 items-center justify-between">
            <Label>Name Color</Label>
            <div className="h-0 border-b border-tertiary/50 grow" />
            <ColorPicker
              color={form.color ?? user.color ?? getColor(user.id)}
              setColor={(color) => setForm({ ...form, color })}
            />
          </div>
          <div className="flex flex-row gap-2 items-center justify-between">
            <Label>Background Color</Label>
            <div className="h-0 border-b border-tertiary/50 grow" />
            <ColorPicker
              color={
                form.background_color ?? user.background_color ?? "#101010"
              }
              setColor={(color) =>
                setForm({ ...form, background_color: color })
              }
            />
          </div>
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
      <div className="w-full flex flex-col gap-2 items-center">
        <div className="flex flex-col gap-2 w-fit">
          <Label>Preview</Label>
          <AuthorPlate
            author={{
              ...user,
              ...form,
              status:
                form.default_status ?? user.default_status ?? StatusType.ONLINE,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ThemeSettings() {
  const { theme, setThemeColor, resetColor } = useUserSettings();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-2 items-center justify-between">
        <Label>Primary Color</Label>
        <div className="h-0 border-b border-tertiary/50 grow" />
        <Button
          icon={RefreshCcwIcon}
          onClick={() => resetColor("primary")}
          disabled={theme.colors.primary === defaultTheme.primary}
        />
        <ColorPicker
          color={theme.colors.primary}
          setColor={(color) => setThemeColor("primary", color)}
        />
      </div>
      <div className="flex flex-row gap-2 items-center justify-between">
        <Label>Secondary Color</Label>
        <div className="h-0 border-b border-tertiary/50 grow" />
        <Button
          icon={RefreshCcwIcon}
          onClick={() => resetColor("secondary")}
          disabled={theme.colors.secondary === defaultTheme.secondary}
        />
        <ColorPicker
          color={theme.colors.secondary}
          setColor={(color) => setThemeColor("secondary", color)}
        />
      </div>
      <div className="flex flex-row gap-2 items-center justify-between">
        <Label>Tertiary Color</Label>
        <div className="h-0 border-b border-tertiary/50 grow" />
        <Button
          icon={RefreshCcwIcon}
          onClick={() => resetColor("tertiary")}
          disabled={theme.colors.tertiary === defaultTheme.tertiary}
        />
        <ColorPicker
          color={theme.colors.tertiary}
          setColor={(color) => setThemeColor("tertiary", color)}
        />
      </div>
      <div className="flex flex-row gap-2 items-center justify-between">
        <Label>Background Color</Label>
        <div className="h-0 border-b border-tertiary/50 grow" />
        <Button
          icon={RefreshCcwIcon}
          onClick={() => resetColor("background")}
          disabled={theme.colors.background === defaultTheme.background}
        />
        <ColorPicker
          color={theme.colors.background}
          setColor={(color) => setThemeColor("background", color)}
        />
      </div>
    </div>
  );
}

function EmojisSettings() {
  const emojis = useEmojis();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex itenms-center justify-between gap-2">
        <p>upload emojis to use in your messages</p>
        <Button
          onClick={() => {
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.multiple = true;
            fileInput.accept = "*";
            fileInput.onchange = (e) => {
              const file = (e.target as HTMLInputElement)?.files?.[0];
              if (file) {
                createEmoji(file.name, file);
              }
            };
            fileInput.style.display = "none";
            document.body.appendChild(fileInput);
            fileInput.click();
          }}
        >
          Create Emoji
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-tertiary/30 pt-4 mt-4">
        {Object.values(emojis).length === 0 && (
          <div className="flex items-center gap-2 text-secondary/50">
            <p>no emojis yet. Try uploading one!</p>
          </div>
        )}
        {Object.values(emojis).map((emoji) => (
          <div key={emoji.id} className="flex items-center gap-2">
            <Emoji emoji={emoji} className="w-8 h-8" />
            <Input
              className="text-primary w-full"
              value={emoji.name}
              maxLength={32}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
                updateEmoji(emoji.id, e.target.value)
              }
            />
            <Button variant="danger" onClick={() => deleteEmoji(emoji.id)}>
              delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function User() {
  const user = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsTab = searchParams.get("settingsTab");

  if (!user) {
    return null;
  }

  return (
    <>
      <div className="border-t border-tertiary h-12 flex items-center justify-between">
        <ListAuthor author={user} />
        <Button
          icon={SettingsIcon}
          onClick={() => setSearchParams({ settingsTab: "user" })}
        />
      </div>

      <Modal
        title="Settings"
        open={Boolean(settingsTab)}
        className={classes(settingsTab === "user" && "sm:max-w-4xl")}
        onClose={() => setSearchParams({})}
      >
        <div className="flex flex-col gap-8">
          <Tabs
            value={settingsTab ?? ""}
            onChange={(value) => setSearchParams({ settingsTab: value })}
          >
            <Tab name="User" value="user" />
            <Tab name="Theme" value="theme" />
            <Tab name="Emojis" value="emojis" />
          </Tabs>
          {settingsTab === "user" && <UserSettings />}
          {settingsTab === "theme" && <ThemeSettings />}
          {settingsTab === "emojis" && <EmojisSettings />}
        </div>
      </Modal>
    </>
  );
}
