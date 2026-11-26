"use client";

import React, { useId, useRef, useState } from "react";
import { FileText, Lock, Trash2, Upload } from "lucide-react";
import type { ListingDocument, ListingDocumentKind } from "@/types";
import { useAuth } from "@/context/AuthContext";
import {
  DOCUMENT_KIND_LABELS,
  MAX_LISTING_DOCUMENTS,
  removeListingDocument,
  uploadListingDocument,
} from "@/lib/data/documents";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";

/**
 * Host: private documents that help SpaceGo verify the listing. They go to a
 * private bucket that only the host and SpaceGo admins can open.
 */
export function DocumentUploader({
  documents,
  onChange,
}: {
  documents: ListingDocument[];
  onChange: (next: ListingDocument[]) => void;
}) {
  const { user } = useAuth();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<ListingDocumentKind>("authority");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Files uploaded in this visit can be deleted at once; saved ones are only
  // detached from the listing when the form is saved.
  const [fresh, setFresh] = useState<string[]>([]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!user) {
      setMessage("Sign in again to upload documents.");
      return;
    }
    if (documents.length >= MAX_LISTING_DOCUMENTS) {
      setMessage(`You can add up to ${MAX_LISTING_DOCUMENTS} documents.`);
      return;
    }
    setBusy(true);
    setMessage("");
    const result = await uploadListingDocument(file, kind, user.id);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setFresh((prev) => [...prev, result.data.path]);
    onChange([...documents, result.data]);
    setMessage(`${result.data.name} uploaded. Only you and the SpaceGo team can open it.`);
  };

  const remove = async (doc: ListingDocument) => {
    onChange(documents.filter((d) => d.path !== doc.path));
    if (fresh.includes(doc.path)) await removeListingDocument(doc.path);
    setMessage(`${doc.name} removed.`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <Lock className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
          Verification documents (optional, private)
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Help SpaceGo confirm you may list this space: a lease or letter of permission, proof of ownership, a business
          registration, or a utility bill for the address. Only you and the SpaceGo team can open these files. Please
          don&apos;t upload Aadhaar, PAN or bank details.
        </p>
      </div>

      {documents.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line">
          {documents.map((d) => (
            <li key={d.path} className="flex items-center gap-3 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-ink">{DOCUMENT_KIND_LABELS[d.kind]}</span>
                <span className="block truncate text-ink-subtle">{d.name}</span>
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => void remove(d)} aria-label={`Remove ${d.name}`}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-72">
          <Select label="Type of document" value={kind} onChange={(e) => setKind(e.target.value as ListingDocumentKind)}>
            {(Object.keys(DOCUMENT_KIND_LABELS) as ListingDocumentKind[]).map((k) => (
              <option key={k} value={k}>
                {DOCUMENT_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </div>
        <input
          ref={inputRef}
          id={`${id}-file`}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          aria-label="Verification document file"
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          isLoading={busy}
          disabled={documents.length >= MAX_LISTING_DOCUMENTS}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Upload a file
        </Button>
      </div>
      <p className="text-sm text-ink-subtle">PDF, JPEG or PNG, up to 10 MB each, up to {MAX_LISTING_DOCUMENTS} files.</p>
      <p aria-live="polite" className="text-sm text-ink-muted">
        {message}
      </p>
    </div>
  );
}
