import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { RoutCardDialog } from "@/components/wallet/RoutCardDialog";
import { useMyHandle } from "@/hooks/useMyHandle";

const TITLE = "Mijn ROUT-kaart | ROUT";
const DESC = "Bekijk en beheer je ROUT-kaart, wallet-passen en contactkaart.";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { t } = useTranslation();
  const handle = useMyHandle();
  return (
    <AppLayout title={t("walletPage.title")} description={t("walletPage.description")} crumbs={[{ label: t("walletPage.title") }]}>
      {handle === undefined ? (
        <p className="text-sm text-muted-foreground">{t("walletPage.loading")}</p>
      ) : handle ? (
        <RoutCardDialog inline open onOpenChange={() => {}} handle={handle} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("walletPage.noHandle")}</p>
      )}
    </AppLayout>
  );
}
