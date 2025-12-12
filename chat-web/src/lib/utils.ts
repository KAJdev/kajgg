export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + (str.codePointAt(i) ?? 0)) >>> 0;
  }
  return hash;
}

export function usePageFocused() {
  const [isFocused, setIsFocused] = useState(
    typeof document !== "undefined"
      ? document.visibilityState === "visible"
      : true
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      setIsFocused(document.visibilityState === "visible");
    };
    const onPageHide = () => {
      setIsFocused(false);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return isFocused;
}

export function getIsPageFocused() {
  return typeof document !== "undefined"
    ? document.visibilityState === "visible"
    : true;
}
