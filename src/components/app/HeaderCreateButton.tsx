"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreationMenuModal } from "@/components/compose/CreationMenuModal";

export function HeaderCreateButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-9 place-items-center rounded-full border border-border/80 bg-muted/45 text-muted-foreground transition hover:text-foreground hover:bg-muted lg:hidden"
        aria-label="Create post, story, reel, live or note"
        data-testid="header-create"
      >
        <Plus className="size-4" aria-hidden />
      </button>

      <CreationMenuModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
