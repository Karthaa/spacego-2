"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SpaceGoStore } from "@/lib/data/store";
import { Space } from "@/types";
import { VerificationBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import {
  Building2,
  PlusCircle,
  Edit3,
  Trash2,
  ExternalLink,
  Eye,
  Users,
  MapPin,
  Sparkles,
} from "lucide-react";

export default function OwnerPropertiesPage() {
  const { success } = useToast();
  const [spaces, setSpaces] = useState<Space[]>([]);

  const loadSpaces = () => {
    const list = SpaceGoStore.getSpaces();
    setSpaces(list);
  };

  useEffect(() => {
    loadSpaces();
  }, []);

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "published" ? "draft" : "published";
    SpaceGoStore.updateSpace(id, { status: nextStatus as any });
    loadSpaces();
    success(
      nextStatus === "published" ? "Listing Published" : "Listing Set to Draft",
      "Availability has been updated on the public marketplace."
    );
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to remove this workspace listing?")) {
      SpaceGoStore.deleteSpace(id);
      loadSpaces();
      success("Space Removed", "The workspace listing has been deleted.");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            My Workspace Listings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage published workspaces, configure rates, and monitor Space Passport™ audit statuses.
          </p>
        </div>

        <Link href="/owner/spaces/new">
          <Button variant="teal" size="sm" className="font-bold gap-1.5">
            <PlusCircle className="w-4 h-4" />
            <span>Add New Workspace</span>
          </Button>
        </Link>
      </div>

      {spaces.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-8 h-8" />}
          title="No properties listed yet"
          description="Create your first workspace listing or submit an idle property for activation."
          actionLabel="Create Listing"
          onAction={() => (window.location.href = "/owner/spaces/new")}
        />
      ) : (
        <div className="space-y-4">
          {spaces.map((space) => (
            <div
              key={space.id}
              className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
            >
              <div className="flex items-start sm:items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={space.images[0]?.url}
                  alt={space.title}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-slate-200 shrink-0"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <VerificationBadge level={space.verification_level} />
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {space.category.replace("_", " ")}
                    </span>
                    <button
                      onClick={() => handleToggleStatus(space.id, space.status)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded cursor-pointer transition-colors ${
                        space.status === "published"
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                      }`}
                    >
                      ● {space.status}
                    </button>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{space.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{space.location.address}, {space.location.city}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> Up to {space.capacity} seats
                    </span>
                  </div>

                  <div className="text-xs text-teal-800 font-semibold pt-0.5">
                    Rate: {formatCurrency(space.pricing.daily || space.pricing.hourly || 0)}/{space.pricing.daily ? "day" : "hr"}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end lg:self-center">
                <Link href={`/spaces/${space.id}`}>
                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </Button>
                </Link>

                <button
                  onClick={() => handleToggleStatus(space.id, space.status)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {space.status === "published" ? "Unpublish" : "Publish"}
                </button>

                <button
                  onClick={() => handleDelete(space.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  aria-label="Delete listing"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
