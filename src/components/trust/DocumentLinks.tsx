"use client";

import React, { useState } from "react";
import { FileText } from "lucide-react";
import type { ListingDocument } from "@/types";
import { DOCUMENT_KIND_LABELS, signedDocumentUrl } from "@/lib/data/documents";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/** Admin and host: open private documents through a 60-second signed link. */
export function DocumentLinks({ documents }: { documents: ListingDocument[] }) {
  const { error } = useToast();
  const [opening, setOpening] = useState<string | null>(null);

  if (documents.length === 0) {
    return <p className="text-sm text-ink-subtle">No documents uploaded.</p>;
  }

  const open = async (path: string) => {
    // Open the tab first so pop-up blockers allow it, then point it at the link.
    const tab = window.open("about:blank", "_blank");
    setOpening(path);
    const result = await signedDocumentUrl(path);
    setOpening(null);
    if (!result.ok) {
      tab?.close();
      error("Could not open the document", result.error);
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = result.data;
    } else {
      window.location.assign(result.data);
    }
  };

  return (
    <ul className="space-y-1.5">
      {documents.map((d) => (
        <li key={d.path} className="flex flex-wrap items-center gap-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          <span className="text-ink">{DOCUMENT_KIND_LABELS[d.kind]}</span>
          <span className="max-w-48 truncate text-ink-subtle" title={d.name}>
            {d.name}
          </span>
          <Button variant="ghost" size="sm" isLoading={opening === d.path} onClick={() => void open(d.path)} aria-label={`Open ${d.name}`}>
            Open
          </Button>
        </li>
      ))}
    </ul>
  );
}
