import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/layout/header";
import { HtmlLangSetter } from "@/components/layout/html-lang-setter";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "vi" | "ko")) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <HtmlLangSetter locale={locale} />
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
      <Toaster />
    </NextIntlClientProvider>
  );
}
