"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, Loader2 } from "lucide-react";
import { duplicateRubric } from "@/lib/actions/rubrics";
import { isRedirectError } from "@/lib/redirect-error";
import { Button } from "@/components/ui/button";

export function DuplicateRubricButton({ rubricId }: { rubricId: string }) {
  const t = useTranslations("rubrics");
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setFailed(false);
          startTransition(async () => {
            try {
              const result = await duplicateRubric(rubricId); // redirects on success
              if (result && !result.ok) setFailed(true);
            } catch (error) {
              if (isRedirectError(error)) throw error;
              setFailed(true);
            }
          });
        }}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Copy aria-hidden />}
        {t("duplicate")}
      </Button>
      {failed && (
        <span role="alert" className="text-sm text-destructive">
          {t("duplicateError")}
        </span>
      )}
    </div>
  );
}
