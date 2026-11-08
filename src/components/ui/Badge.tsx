"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { VerificationLevel, BookingStatus, ActivationStatus } from "@/types";
import { ShieldCheck, CheckCircle2, Clock, AlertTriangle, XCircle, Sparkles } from "lucide-react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "neutral" | "brand";
  size?: "sm" | "md";
}

export function Badge({ className, variant = "default", size = "sm", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        size === "sm" && "text-xs px-2.5 py-0.5 gap-1",
        size === "md" && "text-xs px-3 py-1 gap-1.5",
        variant === "default" && "bg-slate-100 text-slate-700 border border-slate-200",
        variant === "brand" && "bg-teal-50 text-teal-800 border border-teal-200",
        variant === "success" && "bg-emerald-50 text-emerald-800 border border-emerald-200",
        variant === "warning" && "bg-amber-50 text-amber-800 border border-amber-200",
        variant === "error" && "bg-rose-50 text-rose-800 border border-rose-200",
        variant === "neutral" && "bg-slate-50 text-slate-600 border border-slate-200",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function VerificationBadge({ level }: { level: VerificationLevel }) {
  switch (level) {
    case "pro":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-teal-500/10 to-sky-500/10 text-teal-900 border border-teal-300">
          <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          SpaceGo Pro
        </span>
      );
    case "ready":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          SpaceGo Ready
        </span>
      );
    case "checked":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200">
          <CheckCircle2 className="w-3 h-3 text-sky-600 shrink-0" />
          Checked
        </span>
      );
    case "listed":
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          Listed (Unverified)
        </span>
      );
  }
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  switch (status) {
    case "approved":
      return (
        <Badge variant="success">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Approved & Active
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="warning">
          <Clock className="w-3 h-3 text-amber-600" />
          Pending Host
        </Badge>
      );
    case "declined":
      return (
        <Badge variant="error">
          <XCircle className="w-3 h-3 text-rose-600" />
          Declined
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="neutral">
          <XCircle className="w-3 h-3 text-slate-400" />
          Cancelled
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="neutral">
          <CheckCircle2 className="w-3 h-3 text-slate-500" />
          Completed
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
}

export function ActivationStatusBadge({ status }: { status: ActivationStatus }) {
  switch (status) {
    case "ready_for_launch":
      return (
        <Badge variant="success">
          <Sparkles className="w-3 h-3 text-emerald-600" />
          Ready for Launch
        </Badge>
      );
    case "approved_for_assessment":
      return (
        <Badge variant="brand">
          <ShieldCheck className="w-3 h-3 text-teal-600" />
          Approved for Assessment
        </Badge>
      );
    case "assessment_required":
      return (
        <Badge variant="warning">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          Assessment Required
        </Badge>
      );
    case "under_review":
      return (
        <Badge variant="warning">
          <Clock className="w-3 h-3 text-amber-600" />
          Under Review
        </Badge>
      );
    case "submitted":
      return (
        <Badge variant="neutral">
          <Clock className="w-3 h-3 text-slate-500" />
          Submitted
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="error">
          <XCircle className="w-3 h-3 text-rose-600" />
          Declined
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
}
