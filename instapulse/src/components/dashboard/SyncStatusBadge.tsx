import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, AlertTriangle, Ban } from "lucide-react";

type Status = "active" | "pending" | "failed" | "unavailable" | "disabled";

const statusConfig: Record<
  Status,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  active: { label: "Active", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  pending: { label: "Pending", icon: Clock, className: "bg-amber-100 text-amber-700 border-amber-200" },
  failed: { label: "Failed", icon: XCircle, className: "bg-red-100 text-red-700 border-red-200" },
  unavailable: { label: "API Unavailable", icon: AlertTriangle, className: "bg-orange-100 text-orange-700 border-orange-200" },
  disabled: { label: "Disabled", icon: Ban, className: "bg-gray-100 text-gray-500 border-gray-200" },
};

export function SyncStatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.className} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
