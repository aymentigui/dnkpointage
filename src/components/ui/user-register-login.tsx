"use client"

import React, { useEffect } from 'react'
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useSession } from '@/hooks/use-session'
import { logoutUser } from '@/actions/auth/auth'

export function UserRegisterLogin() {
  const translate = useTranslations("System")
  const translateMenu = useTranslations("Menu")
  const { session, setSession } = useSession()

  const router = useRouter()

  useEffect(() => {
    if(session.status===200 && session.data && !session.data.user){
      window.location.reload()
    }
  }, [session])

  const logout = async () => {
    const response = await logoutUser();
    if (response.status === 200) {
      setSession({})
      router.push("/")
    }
  };

  return (
    <>
      {!session || !session.data || !session.data.user || !session.data.user.id ?
        <Button onClick={() => router.push("/auth/login")} className="w-auto flex px-3 " variant="outline" size="icon">
          <span className=" h-[1.2rem] transition-all rotate-0 scale-100">{translate("registerorlogin")}</span>
        </Button>
        :
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-auto flex px-3 " variant="outline" size="icon">
              <span className=" h-[1.2rem] transition-all rotate-0 scale-100">{session.data.user.username ?? session.data.user.firstname + " " + session.data.user.lastname}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push("/admin/settings")}>
              {translate("settings")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              {translate("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    </>
  )
}
