"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** A server action already bound to the row id. It redirects when done. */
  action: () => Promise<void>;
  label: string;
  pendingLabel: string;
  confirmMessage: string;
};

export function DeleteButton({ action, label, pendingLabel, confirmMessage }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(confirmMessage)) return;
        startTransition(() => action());
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
      {pending ? pendingLabel : label}
    </Button>
  );
}
