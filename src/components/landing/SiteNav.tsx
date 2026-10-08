import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Menu, X, LogIn, LogOut, User, Ticket, UserCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const links = [
  { href: "/#beranda", label: "Beranda" },
  { href: "/#events", label: "Event" },
  { href: "/#features", label: "Fitur" },
  { href: "/#green-impact", label: "Green Impact" },
  { href: "/#about", label: "Tentang" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Berhasil keluar");
    navigate({ to: "/" });
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-all duration-300",
        scrolled
          ? "border-border bg-background/85 backdrop-blur-md shadow-[var(--shadow-soft)]"
          : "border-transparent bg-background/60 backdrop-blur-sm",
      )}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to="/" aria-label="ECO-DIGITAL EVENT KIT">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Navigasi utama">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          {!loading &&
            (user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <User className="size-5 text-foreground/80" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-2xl">
                  <div className="px-3 py-2 text-sm">
                    <p className="truncate font-medium">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
                    <Link to="/profil">
                      <UserCircle className="size-4 mr-2" /> Profil Saya
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
                    <Link to="/tiket">
                      <Ticket className="size-4 mr-2" /> Tiket Saya
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive cursor-pointer rounded-xl"
                  >
                    <LogOut className="size-4 mr-2" /> Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/login">
                  <LogIn className="size-4 mr-2" /> Masuk
                </Link>
              </Button>
            ))}

          <Button asChild className="rounded-full">
            <a href="/#events">
              Lihat Event <ArrowRight className="size-4" />
            </a>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
          className="inline-flex size-10 items-center justify-center rounded-full border border-border text-foreground md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-5 pb-6 pt-4 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Navigasi mobile">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="mt-4 flex flex-col gap-2">
            {!loading &&
              (user ? (
                <>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full rounded-full justify-start"
                  >
                    <Link to="/profil" onClick={() => setOpen(false)}>
                      <UserCircle className="size-4 mr-2" /> Profil Saya
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full rounded-full justify-start"
                  >
                    <Link to="/tiket" onClick={() => setOpen(false)}>
                      <Ticket className="size-4 mr-2" /> Tiket Saya
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      handleLogout();
                    }}
                    className="w-full rounded-full text-destructive hover:text-destructive justify-start"
                  >
                    <LogOut className="size-4 mr-2" /> Keluar
                  </Button>
                </>
              ) : (
                <Button asChild variant="outline" className="w-full rounded-full">
                  <Link to="/login" onClick={() => setOpen(false)}>
                    <LogIn className="size-4 mr-2" /> Masuk
                  </Link>
                </Button>
              ))}

            <Button asChild className="w-full rounded-full">
              <a href="/#events" onClick={() => setOpen(false)}>
                Lihat Event <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
