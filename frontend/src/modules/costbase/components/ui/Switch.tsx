import React from "react";

const Switch = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { id: string }
>(({ className, id, ...props }, ref) => (
  <div className={`flex items-center ${className}`}>
    <input
      id={id}
      type="checkbox"
      ref={ref}
      className="peer sr-only"
      {...props}
    />
    <label
      htmlFor={id}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-zinc-700 transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 peer-checked:bg-emerald-500"
    >
      <span className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out peer-checked:translate-x-4 peer-unchecked:translate-x-0" />
    </label>
  </div>
));
Switch.displayName = "Switch";

export { Switch };