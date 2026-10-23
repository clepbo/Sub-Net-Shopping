import type { ApprovalStatus } from "@/generated/prisma/enums";
import { Badge, Notice, type Tone } from "./ui";

export const APPROVAL_TONE: Record<ApprovalStatus, Tone> = {
  PENDING: "yellow",
  APPROVED: "green",
  REJECTED: "red",
  SUSPENDED: "red",
};

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  PENDING: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  return (
    <Badge tone={APPROVAL_TONE[status]} className="shrink-0 whitespace-nowrap">
      {APPROVAL_LABEL[status]}
    </Badge>
  );
}

/** Explains an account's approval state to its owner. */
export function ApprovalNotice({ status, reason, kind }: { status: ApprovalStatus; reason: string | null; kind: "supermarket" | "rider" }) {
  if (status === "APPROVED") return null;
  const subject = kind === "supermarket" ? "Your supermarket" : "Your rider account";
  if (status === "PENDING") {
    return (
      <Notice tone="yellow" title={`${subject} is awaiting approval`}>
        {kind === "supermarket"
          ? "Customers can't see your store yet. Use this time to complete your profile and opening hours."
          : "You'll be able to go online once an admin approves you. Make sure your vehicle details are correct."}
      </Notice>
    );
  }
  return (
    <Notice tone="red" title={`${subject} was ${status === "REJECTED" ? "not approved" : "suspended"}`}>
      {reason && <p>Reason: {reason}</p>}
      <p>
        {status === "REJECTED"
          ? "Update your details and contact Sub Net support to be reviewed again."
          : "Contact Sub Net support to resolve this."}
      </p>
    </Notice>
  );
}
