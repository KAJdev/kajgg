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
  emojiQuery,
}: {
  content: string;
  attachments?: Attachment[];
  setContent: (content: string) => void;
  setAttachments?: React.Dispatch<React.SetStateAction<Attachment[]>>;
  onSubmit: () => void;
  placeholder?: string;
  editing?: boolean;
  autofocus?: boolean;
  emojiQuery?: string | null;
}) {
  const { channelId } = useParams();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastTypedRef = useRef<number>(0);
  const didAutofocusRef = useRef(false);

  function autosize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    if (
      channelId &&
      Date.now() - lastTypedRef.current > 10_000 &&
      content.length > 0
    ) {
      lastTypedRef.current = Date.now() - 1_000;
      startTyping(channelId).then(() => (lastTypedRef.current = Date.now()));
    }
  }, [content, channelId]);

  useLayoutEffect(() => {
    if (!autofocus) {
      didAutofocusRef.current = false;
      return;
    }

    const el = inputRef.current;
    if (!el) return;

    // only do this once per autofocus "arm" so we don't fight the user's cursor
    if (didAutofocusRef.current) return;
    didAutofocusRef.current = true;

    // run after the element is fully laid out so selection sticks
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(content.length, content.length);
    });
  }, [autofocus, content.length]);

  useEffect(() => {
    autosize();
  }, [content]);

  return (
    <div className="flex flex-col px-2 border border-tertiary min-w-0">
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
      <div className="flex items-start gap-2 min-h-12 w-full">
        {!editing && (
          <Button
            icon={PlusIcon}
            className="h-12 pl-2 pr-1"
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
        <textarea
          ref={inputRef}
          className="flex-1 bg-transparent py-3 px-1 min-h-12 placeholder:text-tertiary outline-none resize-none overflow-y-auto max-h-48 leading-6"
          placeholder={placeholder}
          value={content}
          rows={1}
          onChange={(e) => {
            setContent((e.target as HTMLTextAreaElement).value);
            autosize();
          }}
          onKeyDown={(e) => {
            const key = e.key.toLowerCase();
            if (
              emojiQuery &&
              (key === "arrowup" ||
                key === "arrowdown" ||
                key === "tab" ||
                key === "enter" ||
                key === "escape")
            ) {
              e.preventDefault();
              return;
            }

            if (key === "enter") {
              if (e.shiftKey) {
                // ctrl+shift => newline
                return;
              }
              e.preventDefault();
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
              "px-3 text-neutral-200 transition h-12",
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
