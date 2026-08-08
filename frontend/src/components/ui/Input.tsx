import type {InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes} from "react";

interface FieldProps extends LabelHTMLAttributes<HTMLLabelElement> {
  label: string;
  hint?: string;
}

export function Field({label, hint, className = "", children, ...rest}: FieldProps & {children: React.ReactNode}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`} {...rest}>
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
      {hint ? <span className="text-xs text-zinc-600">{hint}</span> : null}
    </label>
  );
}

export function Input({className = "", ...rest}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 ${className}`}
      {...rest}
    />
  );
}

export function Textarea({className = "", ...rest}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 ${className}`}
      {...rest}
    />
  );
}
