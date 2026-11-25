"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { VerificationLevel, BookingStatus, ActivationStatus } from "@/types";
import { CheckCircle2, Clock, AlertTriangle, XCircle, BadgeCheck } from "lucide-react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "neutral" | "brand";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

export function Badge({ className, variant = "default", size = "sm", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm font-medium whitespace-nowrap [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-sm",
        (variant === "default" || variant === "neutral") && "bg-surface-muted text-ink-muted",
        variant === "brand" && "bg-accent-soft text-accent-soft-ink",
        variant === "success" && "bg-success-soft text-success",
        variant === "warning" && "bg-warning-soft text-warning",
        variant === "error" && "bg-danger-soft text-danger",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Verification tiers are assigned by SpaceGo admins (the database prevents
 * owners from setting them). New listings start at "listed".
 */
export function VerificationBadge({ level }: { level: VerificationLevel }) {
  switch (level) {
    case "pro":
      return (
        <Badge variant="brand">
          <BadgeCheck aria-hidden="true" />
          SpaceGo Pro
        </Badge>
      );
    case "ready":
      return (
        <Badge variant="brand">
          <BadgeCheck aria-hidden="true" />
          SpaceGo Ready
        </Badge>
      );
    case "checked":
      return (
        <Badge variant="neutral">
          <CheckCircle2 aria-hidden="true" />
          Reviewed by SpaceGo
        </Badge>
      );
    case "listed":
    default:
      return <Badge variant="neutral">New listing</Badge>;
  }
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  switch (status) {
    case "approved":
      return (
        <Badge variant="success">
          <CheckCircle2 aria-hidden="true" />
          Confirmed
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="warning">
          <Clock aria-hidden="true" />
          Awaiting host
        </Badge>
      );
    case "declined":
      return (
        <Badge variant="error">
          <XCircle aria-hidden="true" />
          Declined
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="neutral">
          <XCircle aria-hidden="true" />
          Cancelled
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="neutral">
          <CheckCircle2 aria-hidden="true" />
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
          <CheckCircle2 aria-hidden="true" />
          Ready for launch
        </Badge>
      );
    case "approved_for_assessment":
      return (
        <Badge variant="brand">
          <CheckCircle2 aria-hidden="true" />
          Approved for assessment
        </Badge>
      );
    case "assessment_required":
      return (
        <Badge variant="warning">
          <AlertTriangle aria-hidden="true" />
          Assessment required
        </Badge>
      );
    case "under_review":
      return (
        <Badge variant="warning">
          <Clock aria-hidden="true" />
          Under review
        </Badge>
      );
    case "submitted":
      return (
        <Badge variant="neutral">
          <Clock aria-hidden="true" />
          Submitted
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="error">
          <XCircle aria-hidden="true" />
          Declined
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
}
