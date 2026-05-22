import { Badge } from "@/components/ui/badge";

type AccountType = "own" | "competitor" | "influencer" | "brand" | "other";

const typeConfig: Record<AccountType, { label: string; className: string }> = {
  own: { label: "Own", className: "bg-violet-100 text-violet-700 border-violet-200" },
  competitor: { label: "Competitor", className: "bg-red-100 text-red-700 border-red-200" },
  influencer: { label: "Influencer", className: "bg-pink-100 text-pink-700 border-pink-200" },
  brand: { label: "Brand", className: "bg-blue-100 text-blue-700 border-blue-200" },
  other: { label: "Other", className: "bg-gray-100 text-gray-700 border-gray-200" },
};

export function AccountTypeBadge({ type }: { type: AccountType }) {
  const config = typeConfig[type] || typeConfig.other;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
