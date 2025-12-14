import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";

export function Modal(
  props: StyleableWithChildren & {
    open: boolean;
    onClose?: () => void;
    children: ReactNode;
    style?: CSSProperties;
    bare?: boolean;
    title?: ReactNode;
    animateHeight?: boolean;
  }
) {
  const root = (
    typeof document === "undefined" ? ({} as Document) : document
  ).getElementById?.("modal-root");
  if (!root) {
    console.error("Could not find root element");
    return null;
  }

  const content = (
    <AnimatePresence>{props.open && <Open {...props} />}</AnimatePresence>
  );

  return createPortal(content, root);
}

export function ModalBody({ children, className }: StyleableWithChildren) {
  return (
    <div
      className={classes(
        "flex flex-col gap-4 min-h-0 overflow-x-hidden max-h-[80dvh] overflow-y-auto p-4 -mx-4 -mb-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ModalActions({
  children,
  className,
}: StyleableWithChildren & { className?: string }) {
  return (
    <div className={classes("flex gap-2 items-center justify-end", className)}>
      {children}
    </div>
  );
}

function Open({
  open,
  onClose,
  children,
  className,
  style,
  bare,
  title = "Modal",
}: StyleableWithChildren & {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  style?: CSSProperties;
  bare?: boolean;
  title?: ReactNode;
}) {
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        if (onClose) {
          onClose();
        }
      }
    };

    const themeRoot = document.getElementById("theme-root");

    if (open) {
      document.body.style.overflow = "hidden";

      if (themeRoot) {
        // inert makes it so that only the modal is focusable
        themeRoot.setAttribute("inert", "true");
      }

      document.addEventListener("keydown", handleEscapeKey);
    } else {
      document.body.style.overflow = "";

      if (themeRoot) {
        themeRoot.removeAttribute("inert");
      }
    }

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscapeKey);

      if (themeRoot) {
        themeRoot.removeAttribute("inert");
      }
    };
  }, [open, onClose]);

  return (
    <motion.div
      className={classes(
        "fixed top-0 left-0 z-[1000] flex h-full w-full sm:h-screen sm:w-screen items-end justify-end sm:items-center bg-background sm:justify-center",
        !open && "pointer-events-none"
      )}
      initial="closed"
      animate={open ? "open" : "closed"}
      exit="closed"
      style={style}
    >
      {open && <div className="absolute inset-0 z-0" onClick={onClose} />}
      <motion.div
        className={classes(
          !open && "pointer-events-none",
          "sm:max-w-[40rem] w-full min-w-0 h-fit z-10 min-h-0",
          className
        )}
        initial="closed"
        animate={open ? "open" : "closed"}
        exit="closed"
        aria-modal="true"
        role="dialog"
      >
        {open &&
          (!bare ? (
            <div>
              <Panel>
                <TopBar onClose={onClose}>{title}</TopBar>
                {children}
              </Panel>
              <div className="text-left text-neutral-500 mt-2">
                <button
                  className="text-blue-500 hover:underline cursor-pointer"
                  onClick={onClose}
                >
                  [ escape ]
                </button>{" "}
                to close
              </div>
            </div>
          ) : (
            children
          ))}
      </motion.div>
    </motion.div>
  );
}

export function Panel({ className, children }: StyleableWithChildren) {
  return (
    <div
      className={classes(
        "bg-background min-h-0 border border-neutral-800 overflow-x-hidden shrink-0 flex flex-col p-4 overflow-y-auto max-h-[90dvh]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Title({ className, children }: StyleableWithChildren) {
  return (
    <h1 className={classes("text-left text-xl font-semibold", className)}>
      {children}
    </h1>
  );
}

export function TopBar({
  className,
  children,
  childrenClassName,
  // onClose,
  closeButton,
}: StyleableWithChildren & {
  onClose?: () => void;
  childrenClassName?: string;
  closeButton?: ReactNode;
}) {
  return (
    <div
      className={classes(
        "flex flex-row items-center justify-between mb-4",
        className
      )}
    >
      <div className={childrenClassName}>{children}</div>
      {closeButton}
      {/* {onClose && !closeButton && <Button icon={X} onClick={onClose} />} */}
    </div>
  );
}

export function BottomBar({
  className,
  children,
  border = true,
}: StyleableWithChildren & {
  border?: boolean;
}) {
  return (
    <div
      className={classes(
        "flex flex-row items-center justify-between py-3 px-4",
        border && "border-white/[6%] border-t",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Body({ className, children }: StyleableWithChildren) {
  return <div className={classes("py-3 px-5 mb-3", className)}>{children}</div>;
}
