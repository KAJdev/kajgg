import { Button } from "@theme/Button";
import { PlusIcon, XIcon } from "lucide-react";
import { useParams } from "react-router";
import { startTyping } from "src/lib/api";

export type Attachment = {
  file: File;
  url: string;
};

function AttachmentIcon({ attachment }: { attachment: Attachment }) {
  if (attachment.file.type.startsWith("image/")) {
    return (
      <img src={attachment.url} alt={attachment.file.name} className="h-5" />
    );
  } else if (attachment.file.type.startsWith("video/")) {
    return <video src={attachment.url} className="h-5" />;
  } else if (attachment.file.type.startsWith("audio/")) {
    return <audio src={attachment.url} className="h-5" />;
  } else {
    return null;
  }
}

export function ChatInput({
  content,
  attachments,
  setContent,
  setAttachments,
  onSubmit,
  placeholder,
  editing,
  autofocus,
}: {
  content: string;
  attachments?: Attachment[];
  setContent: (content: string) => void;
  setAttachments?: React.Dispatch<React.SetStateAction<Attachment[]>>;
  onSubmit: () => void;
  placeholder?: string;
  editing?: boolean;
  autofocus?: boolean;
}) {
  const { channelId } = useParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTypedRef = useRef<number>(0);

  useEffect(() => {
    if (
      channelId &&
      Date.now() - lastTypedRef.current > 10_000 &&
      content.length > 0
    ) {
      startTyping(channelId).then(() => (lastTypedRef.current = Date.now()));
    }
  }, [content, channelId]);

  useEffect(() => {
    if (autofocus && editing && inputRef.current) {
      // cursor to end of input
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(content.length, content.length);
    }
  });

  return (
    <div className="flex flex-col px-2 border border-neutral-800 min-w-0">
      {attachments && attachments.length > 0 && (
        <div className="flex items-center gap-2 pt-2 min-w-0 overflow-x-auto scrollbar-hide">
          {attachments.map((attachment) => (
            <div
              key={
                attachment.file.name +
                attachment.file.type +
                attachment.file.size
              }
              className="flex items-center gap-2 border border-neutral-800 p-1 h-8"
            >
              <div className="bg-neutral-800">
                <AttachmentIcon attachment={attachment} />
              </div>
              <div className="flex items-center">
                <p className="max-w-56 overflow-hidden text-ellipsis whitespace-nowrap">
                  {attachment.file.name.split(".").at(0) ??
                    attachment.file.name}
                </p>
                {attachment.file.name.split(".").at(-1) && (
                  <span>.{attachment.file.name.split(".").at(-1)}</span>
                )}
              </div>
              <Button
                variant="danger"
                icon={XIcon}
                onClick={() => {
                  setAttachments?.((prev) =>
                    prev?.filter((a) => a.file.name !== attachment.file.name)
                  );
                }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 h-12 w-full">
        {!editing && (
          <Button
            icon={PlusIcon}
            onClick={() => {
              const fileInput = document.createElement("input");
              fileInput.type = "file";
              fileInput.multiple = true;
              fileInput.accept = "*";
              fileInput.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) {
                  const newAttachments = Array.from(files).map((file) => ({
                    file,
                    url: URL.createObjectURL(file),
                  })) as Attachment[];
                  setAttachments?.((prev) => [
                    ...(prev ?? []),
                    ...newAttachments,
                  ]);
                }
              };
              fileInput.style.display = "none";
              document.body.appendChild(fileInput);
              fileInput.click();
            }}
          />
        )}
        <input
          ref={inputRef}
          className="flex-1 bg-transparent py-2 px-1 text-neutral-100 placeholder:text-neutral-600 outline-none ring-0 transition focus:border-neutral-500/70"
          type="text"
          placeholder={placeholder}
          value={content}
          onChange={(e) => setContent((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSubmit();
            }
          }}
          autoFocus={autofocus}
          onPaste={(e) => {
            const clipboardData = e.clipboardData;
            if (clipboardData) {
              const files = clipboardData.files;
              if (files) {
                const newAttachments = Array.from(files).map((file) => ({
                  file,
                  url: URL.createObjectURL(file),
                })) as Attachment[];
                setAttachments?.((prev) => [
                  ...(prev ?? []),
                  ...newAttachments,
                ]);
              }
            }
          }}
        />
        {!editing && (
          <Button
            className={classes(
              "px-3 py-2 text-neutral-200 transition",
              content.length > 0 || (attachments?.length ?? 0) > 0
                ? "opacity-100"
                : "opacity-50"
            )}
            onClick={onSubmit}
          >
            send
          </Button>
        )}
      </div>
    </div>
  );
}
