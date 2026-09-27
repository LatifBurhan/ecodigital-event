import { Link } from "@tanstack/react-router";
import { Leaf } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-forest-deep text-forest-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-14 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-md">
          <span className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-forest">
              <Leaf className="size-5 text-mint" />
            </span>
            <span className="font-display text-base font-bold">ECO-DIGITAL EVENT KIT</span>
          </span>
          <p className="mt-4 text-sm leading-relaxed text-forest-foreground/70">
            Inovasi digitalisasi conference untuk mewujudkan Green MICE yang efisien dan
            berkelanjutan.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <p className="font-mono text-[0.68rem] tracking-[0.2em] text-mint uppercase">
            Less material · More meaning
          </p>
          <div className="flex gap-5 text-sm text-forest-foreground/75">
            <a href="/#features" className="transition-colors hover:text-mint">
              Fitur
            </a>
            <a href="/#green-impact" className="transition-colors hover:text-mint">
              Green Impact
            </a>
            <a href="/#events" className="transition-colors hover:text-mint">
              Event
            </a>
            <Link to="/admin/login" className="transition-colors hover:text-mint">
              Admin
            </Link>
          </div>
          <p className="text-xs text-forest-foreground/50">
            © {new Date().getFullYear()} ECO-DIGITAL EVENT KIT · Green MICE Initiative
          </p>
        </div>
      </div>
    </footer>
  );
}
