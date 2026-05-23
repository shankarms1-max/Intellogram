"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Aperture,
  BarChart3,
  Image,
  FileText,
  Settings,
  Zap,
  Activity,
  Swords,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/dashboard/media", label: "Media Explorer", icon: Image },
      { href: "/dashboard/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { href: "/dashboard/accounts", label: "All Accounts", icon: Users },
      { href: "/dashboard/competitor", label: "Competitor Intel", icon: Swords },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/connect", label: "Connect Instagram", icon: Aperture },
      { href: "/dashboard/logs", label: "API Logs", icon: Activity },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card min-h-screen">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight">Channel Radar</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label ?? "_root"}>
            {group.label && (
              <p className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = "exact" in item && item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-violet-50 text-violet-700"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Uses official Instagram APIs.
          <br />
          Available metrics depend on Meta API permissions.
        </p>
      </div>
    </aside>
  );
}
