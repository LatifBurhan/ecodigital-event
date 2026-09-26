import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-forest text-forest-foreground">
        <Leaf className="size-5 text-mint" strokeWidth={2.2} />
      </span>
      <span className="leading-tight">
        <span
          className={cn(
            "block font-display text-sm font-bold tracking-tight",
            tone === "light" ? "text-forest-foreground" : "text-foreground",
          )}
        >
          ECO-DIGITAL
        </span>
        <span className="block font-mono text-[0.6rem] tracking-[0.25em] text-muted-foreground">
          EVENT KIT
        </span>
      </span>
    </span>
  );
}
