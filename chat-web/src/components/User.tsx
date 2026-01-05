import {
  defaultTheme,
  useEmojis,
  useUser,
  useUserSettings,
} from "src/lib/cache";
import { ListAuthor } from "./ListAuthor";
import { Loader2Icon, RefreshCcwIcon, SettingsIcon } from "lucide-react";
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
import {
  createEmoji,
  deleteEmoji,
  updateAvatar,
  updateEmoji,
  updateUser,
} from "src/lib/api";
import type { ApiError } from "src/lib/request";
import { getColor } from "src/lib/utils";
import { Emoji } from "./Emoji";
import type { Emoji as EmojiType } from "src/types/models/emoji";
import { Avatar } from "./Avatar";

function UserSettings() {
  const user = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [form, setForm] = useState<Partial<UserType>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const avatarPreviewUrl = useMemo(() => {
    return avatarFile ? URL.createObjectURL(avatarFile) : null;
  }, [avatarFile]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

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
          <Label>Avatar</Label>
          <div className="flex items-center gap-3">
            <Avatar
              id={user.id}
              username={user.username}
              avatarUrl={avatarPreviewUrl ?? user.avatar_url}
              color={user.color}
              size={40}
            />
            <div className="flex flex-col gap-2 w-full">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={avatarBusy}
                onChange={async (e) => {
                  setAvatarError(null);
                  const f = e.target.files?.[0] ?? null;
                  // reset value so picking the same file twice still triggers onchange
                  e.currentTarget.value = "";
                  if (!f) return;

                  setAvatarFile(f);
                  setAvatarBusy(true);
                  try {
                    await updateAvatar(f);
                    setAvatarFile(null);
                  } catch (err) {
                    setAvatarError(
                      err instanceof Error ? err.message : "failed to upload"
                    );
                  } finally {
                    setAvatarBusy(false);
                  }
                }}
              />

              <div className="flex items-center gap-2">
                <Button
                  disabled={avatarBusy}
                  loading={avatarBusy}
                  onClick={async () => {
                    setAvatarError(null);
                    avatarInputRef.current?.click();
                  }}
                >
                  change avatar
                </Button>

                <Button
                  disabled={avatarBusy || !user.avatar_url}
                  loading={avatarBusy}
                  onClick={async () => {
                    setAvatarBusy(true);
                    setAvatarError(null);
                    try {
                      await updateAvatar(null);
                      setAvatarFile(null);
                    } catch (e) {
                      setAvatarError(
                        e instanceof Error ? e.message : "failed to remove"
                      );
                    } finally {
                      setAvatarBusy(false);
                    }
                  }}
                >
                  remove
                </Button>
              </div>

              {avatarError && (
                <div className="text-red-500 text-sm">{avatarError}</div>
              )}
            </div>
          </div>
        </div>

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

function EmojiItem({ emoji }: Readonly<{ emoji: EmojiType }>) {
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [name, setName] = useState(emoji.name);
  return (
    <div key={emoji.id} className="flex items-center gap-2">
      <div className="relative w-8 h-8 shrink-0">
        <Emoji
          emoji={emoji}
          className={classes(updateLoading && "opacity-50", "w-8 h-8")}
        />
        {updateLoading && (
          <Loader2Icon className="absolute top-0 left-0 w-8 h-8 text-primary animate-spin" />
        )}
      </div>
      <Input
        className="text-primary w-full"
        value={name}
        maxLength={32}
        disabled={updateLoading}
        onChange={setName}
        onBlur={async () => {
          if (name === emoji.name) {
            return;
          }
          setUpdateLoading(true);
          let newEmoji: EmojiType | null = null;
          try {
            newEmoji = await updateEmoji(emoji.id, name);
          } catch {
            setName(emoji.name);
          } finally {
            setName(newEmoji?.name ?? emoji.name);
            setUpdateLoading(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
      <Button
        loading={deleteLoading}
        variant="danger"
        onClick={async () => {
          setDeleteLoading(true);
          await deleteEmoji(emoji.id);
          setDeleteLoading(false);
        }}
      >
        delete
      </Button>
    </div>
  );
}

function EmojisSettings() {
  const emojis = useEmojis();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-secondary/50">upload emojis to use in your messages</p>
      <div>
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

      <div className="flex flex-col gap-2 border-t border-tertiary/30 pt-4">
        {Object.values(emojis).length === 0 && (
          <div className="flex items-center gap-2 text-secondary/50">
            <p>no emojis yet. Try uploading one!</p>
          </div>
        )}
        {Object.values(emojis).map((emoji) => (
          <EmojiItem key={emoji.id} emoji={emoji} />
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
