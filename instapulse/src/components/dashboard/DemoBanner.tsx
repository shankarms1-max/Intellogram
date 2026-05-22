"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export function DemoBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3 mb-6">
      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
      <div className="text-sm">
        <p className="font-medium text-amber-800">Demo Mode Active</p>
        <p className="text-amber-700 mt-0.5">
          You are viewing demo data. Add Meta API credentials and{" "}
          <Link href="/dashboard/connect" className="underline font-medium">
            connect Instagram
          </Link>{" "}
          to fetch live data.
        </p>
      </div>
    </div>
  );
}
