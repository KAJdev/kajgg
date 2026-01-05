import { motion } from "motion/react";

export function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={classes(
        "p-0.5 cursor-pointer w-10 h-5 flex",
        checked ? "bg-primary justify-end" : "bg-tertiary justify-start"
      )}
      onClick={() => onChange(!checked)}
    >
      <motion.div
        className={classes("top-0 aspect-square h-full bg-background")}
        layout="position"
        transition={{
          type: "spring",
          stiffness: 800,
          damping: 50,
        }}
        initial={false}
      />
    </div>
  );
}
