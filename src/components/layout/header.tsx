"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LayoutDashboard, FileText, ClipboardList, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "plans", href: "/plans", icon: FileText },
  { key: "reports", href: "/reports", icon: ClipboardList },
] as const;

export function Header() {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();

  const otherLocale = locale === "vi" ? "ko" : "vi";
  const otherLocaleLabel = locale === "vi" ? "한국어" : "Tiếng Việt";

  // Build the path for locale switching: replace /vi/ or /ko/ with the other locale
  const switchLocalePath = pathname.replace(`/${locale}`, `/${otherLocale}`);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
        {/* Logo / App Name */}
        <Link
          href={`/${locale}/dashboard`}
          className="mr-6 flex items-center gap-2 font-bold text-lg"
        >
          <span className="hidden sm:inline">{t("appName")}</span>
          <span className="sm:hidden">M&E</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
            const fullHref = `/${locale}${href}`;
            const isActive =
              pathname === fullHref || pathname.startsWith(`${fullHref}/`);

            return (
              <Link key={key} href={fullHref}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-2",
                    isActive && "font-semibold"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t(key)}</span>
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Language Switch */}
        <Link href={switchLocalePath}>
          <Button variant="outline" size="sm" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{otherLocaleLabel}</span>
            <span className="sm:hidden">{otherLocale.toUpperCase()}</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
