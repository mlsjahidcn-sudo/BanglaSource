import { type ButtonHTMLAttributes, type AnchorHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "link";
type Size = "xs" | "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center font-medium tracking-tight transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1";

const variants: Record<Variant, string> = {
  // Primary brand action — cyan-600, with darker hover + subtle inner
  // shadow for the "pressable" feeling. The "secondary" variant is
  // slate-900 for destructive / neutral admin actions (delete, cancel)
  // that shouldn't carry brand weight.
  primary:
    "bg-cyan-600 text-white hover:bg-cyan-700 active:bg-cyan-800 shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]",
  secondary:
    "bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-800",
  ghost:
    "bg-transparent text-fg hover:bg-slate-100 active:bg-slate-200",
  outline:
    "bg-transparent text-fg border border-border hover:border-border-strong hover:bg-slate-50",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-700",
  link:
    "bg-transparent text-cyan-700 hover:text-cyan-800 hover:underline underline-offset-2 px-0 h-auto",
};

const sizes: Record<Size, string> = {
  xs: "h-7 px-2.5 text-[11.5px] rounded-md gap-1",
  sm: "h-9 px-3.5 text-[13px] rounded-md gap-1.5",
  md: "h-11 px-5 text-sm rounded-md gap-2",
  lg: "h-12 px-6 text-[15px] rounded-md gap-2",
};

type CommonProps = { variant?: Variant; size?: Size; className?: string };

export const Button = forwardRef<
  HTMLButtonElement,
  CommonProps & ButtonHTMLAttributes<HTMLButtonElement>
>(function Button(
  { variant = "primary", size = "md", className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

type LinkButtonProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "size"> & {
    size?: Size;
  };

export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(
  function LinkButton(
    { variant = "primary", size = "md", className = "", children, ...rest },
    ref,
  ) {
    return (
      <a
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...rest}
      >
        {children}
      </a>
    );
  },
);
