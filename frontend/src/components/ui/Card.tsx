import type {HTMLAttributes} from "react";

export function Card({className = "", children, ...rest}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-[0_0_0_1px_rgba(0,0,0,0.2)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({className = "", children, ...rest}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardBody({className = "", children, ...rest}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-5 py-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}
