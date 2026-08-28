import React from "react";

const BadgeToggle = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
>(({ className, active, ...props }, ref) => {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600";
  const inactive = "bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-zinc-800";
  return (
    <button
      ref={ref}
      className={`${base} ${active ? className : inactive}`}
      {...props}
    />
  );
});
BadgeToggle.displayName = "BadgeToggle";

export { BadgeToggle };