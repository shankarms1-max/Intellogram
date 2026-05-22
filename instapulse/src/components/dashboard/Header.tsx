"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  workspaceName?: string;
}

export function Header({ workspaceName }: HeaderProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-4 md:px-6 gap-4">
      <div className="flex md:hidden items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
          <Zap className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-bold text-base tracking-tight">InstaPulse</span>
      </div>

      <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
        {workspaceName && (
          <>
            <span className="font-medium text-foreground">{workspaceName}</span>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-violet-500">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.image ?? undefined} />
                  <AvatarFallback className="text-xs bg-violet-100 text-violet-700">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name || "User"}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button size="sm" asChild>
            <Link href="/auth/signin">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
