import type {HTMLAttributes} from "react";

export type BadgeTone = "neutral" | "pending" | "success" | "danger" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  pending: "border-amber-800 bg-amber-950/50 text-amber-300",
  success: "border-emerald-800 bg-emerald-950/50 text-emerald-300",
  danger: "border-red-800 bg-red-950/50 text-red-300",
  info: "border-cyan-800 bg-cyan-950/50 text-cyan-300",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({tone = "neutral", className = "", children, ...rest}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${TONE_CLASSES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
