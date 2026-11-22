"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, PencilLine } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { reopenSubmission } from "@/lib/actions/submissions";
import { Button } from "@/components/ui/button";

export function ReopenButton({ submissionId }: { submissionId: string }) {
  const t = useTranslations("submission.approved");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t("reopenConfirm"))) return;
        startTransition(async () => {
          await reopenSubmission(submissionId);
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <PencilLine aria-hidden />}
      {t("reopen")}
    </Button>
  );
}
