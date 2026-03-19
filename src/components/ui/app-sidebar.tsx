import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import LogoutButton from "../my/button/logout-button";
import { getLocale } from "next-intl/server";
import { getMenuItems } from "@/actions/menu-item";
import { getTranslations } from "next-intl/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

export async function AppSidebar() {
  const locale = await getLocale();
  const items = await getMenuItems();
  const t = await getTranslations('Menu');

  return (
    <Sidebar side={locale == "ar" ? "right" : "left"}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('title')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item: any) => (
                item.subItems ?
                  <Collapsible key={item.title}>
                    <CollapsibleTrigger asChild>
                      <div className="px-0">
                        <div className="flex w-full justify-between items-center hover:bg-sidebar-accent py-1 rounded">
                          {item.url && item.url !== ""
                            ? <Link href={item.url}>
                              <div className="flex items-center gap-2 px-2">
                                {item.icon && <item.icon size={18} />}
                                <span>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>{item.title}</TooltipTrigger>
                                      <TooltipContent>
                                        {item.title}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </span>
                              </div>
                            </Link>
                            : <div className="flex items-center gap-2 px-2">
                              {item.icon && <item.icon size={18} />}
                              <span>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>{item.title}</TooltipTrigger>
                                    <TooltipContent>
                                      {item.title}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </span>
                            </div>
                          }
                          <div className="px-2 cursor-pointer">
                            <ChevronDown width={15} />
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenu>
                        {item.subItems.map((subItem: any) => (
                          <SidebarMenuItem key={subItem.title} className="pl-8" >
                            <SidebarMenuButton asChild>
                              <Link href={subItem.url}>
                                {subItem.icon && <subItem.icon />}
                                <span>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>{subItem.title}</TooltipTrigger>
                                      <TooltipContent>
                                        {subItem.title}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </CollapsibleContent>
                  </Collapsible>
                  : <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link href={item.url}>
                        <item.icon />
                        <span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>{item.title}</TooltipTrigger>
                              <TooltipContent>
                                {item.title}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarMenuButton asChild>
          <LogoutButton title={t('logout')} />
        </SidebarMenuButton>
        <SidebarSeparator />
        <SidebarFooter>
          <div className="text-center text-sm text-gray-500">
            {t('footer')}
          </div>
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  )
}