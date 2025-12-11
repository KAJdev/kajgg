export function ChatInput({
  content,
  setContent,
  onSubmit,
  placeholder,
  editing,
  autofocus,
}: {
  content: string;
  setContent: (content: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  editing?: boolean;
  autofocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autofocus && editing && inputRef.current) {
      // cursor to end of input
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(content.length, content.length);
    }
  });

  return (
    <div className="flex items-center gap-2 px-2 h-12 border border-neutral-800">
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
      />
      {!editing && (
        <button
          className={classes(
            "bg-transparent px-3 py-2 text-neutral-200 transition",
            content.length > 0 ? "text-neutral-200" : "text-neutral-500"
          )}
          onClick={onSubmit}
        >
          [ send ]
        </button>
      )}
    </div>
  );
}
