type KeyCombo = string | string[];

type UseKeybindOptions = {
  readonly enabled?: boolean;
  readonly preventDefault?: boolean;
  readonly stopPropagation?: boolean;
  readonly target?: Document | HTMLElement | Window;
};

const modifierMap: Record<string, (e: KeyboardEvent) => boolean> = {
  ctrl: (e) => e.ctrlKey,
  control: (e) => e.ctrlKey,
  meta: (e) => e.metaKey,
  cmd: (e) => e.metaKey,
  command: (e) => e.metaKey,
  shift: (e) => e.shiftKey,
  alt: (e) => e.altKey,
  option: (e) => e.altKey,
};

function normalizeCombos(keys: KeyCombo | KeyCombo[]) {
  const combos = Array.isArray(keys) ? keys : [keys];
  return combos.map((combo) =>
    (Array.isArray(combo) ? combo : [combo]).map((k) => k.toLowerCase())
  );
}

function matches(event: KeyboardEvent, combo: string[]) {
  const pressed = new Set<string>();

  for (const [key, check] of Object.entries(modifierMap)) {
    if (check(event)) pressed.add(key);
  }

  if (event.key) {
    pressed.add(event.key.toLowerCase());
  }

  return combo.every((key) => pressed.has(key));
}

export function useKeybind(
  keys: KeyCombo | KeyCombo[],
  handler: (event: KeyboardEvent) => void,
  options?: UseKeybindOptions
) {
  const handlerRef = useRef(handler);
  const enabled = options?.enabled ?? true;
  const preventDefault = options?.preventDefault ?? false;
  const stopPropagation = options?.stopPropagation ?? false;
  const target = options?.target ?? globalThis.window;

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const combos = useMemo(() => normalizeCombos(keys), [keys]);

  useEffect(() => {
    if (!handlerRef.current) return;
    if (globalThis.window === undefined) return;

    // lil helper for responding to key combos
    const onKeyDown = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (!enabled) return;
      for (const combo of combos) {
        if (matches(keyboardEvent, combo)) {
          if (preventDefault) keyboardEvent.preventDefault();
          if (stopPropagation) keyboardEvent.stopPropagation();
          handlerRef.current?.(keyboardEvent);
          break;
        }
      }
    };

    target.addEventListener("keydown", onKeyDown as EventListener);
    return () => {
      target.removeEventListener("keydown", onKeyDown as EventListener);
    };
  }, [combos, enabled, preventDefault, stopPropagation, target]);
}
