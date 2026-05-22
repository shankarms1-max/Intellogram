import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: number | null | undefined;
  format?: "number" | "percent" | "raw";
  change?: number | null;
  changeLabel?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  unavailable?: boolean;
}

export function MetricCard({
  title,
  value,
  format = "number",
  change,
  changeLabel,
  description,
  icon,
  className,
  unavailable = false,
}: MetricCardProps) {
  const formatted =
    unavailable || value == null
      ? "—"
      : format === "percent"
      ? formatPercent(value)
      : format === "raw"
      ? value.toString()
      : formatNumber(value);

  const TrendIcon =
    change == null ? null : change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const trendColor =
    change == null ? "" : change > 0 ? "text-emerald-500" : change < 0 ? "text-red-500" : "text-muted-foreground";

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        {unavailable ? (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground italic">Not available via Instagram API</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-2xl font-bold tracking-tight">{formatted}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            {TrendIcon && change != null && (
              <div className={cn("flex items-center gap-1 text-xs", trendColor)}>
                <TrendIcon className="h-3 w-3" />
                <span>
                  {change > 0 ? "+" : ""}
                  {format === "percent" ? formatPercent(change) : formatNumber(change)}
                  {changeLabel ? ` ${changeLabel}` : ""}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
