import type {ButtonHTMLAttributes} from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-cyan-400 text-zinc-950 hover:bg-cyan-300 disabled:bg-cyan-400/40",
  secondary: "border border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800",
  danger: "border border-red-900 bg-red-950/40 text-red-300 hover:bg-red-950/70",
  ghost: "text-zinc-400 hover:text-zinc-100",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}
