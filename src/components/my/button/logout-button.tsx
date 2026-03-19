"use client"
import { logoutUser } from '@/actions/auth/auth';
import { LogOut } from 'lucide-react';
import React from 'react'

const LogoutButton = ({title}:{title:string}) => {
  const logout = async () => {
    const response = await logoutUser();
    if (response.status === 200) {
      window.location.href = '/auth/login';
    }
  };

  return (
    <div onClick={logout} className="flex rounded-lg items-center mx-2 p-2 gap-2 hover:bg-sidebar-accent cursor-pointer">
      <LogOut className='w-4 h-4' />
      <span>{title}</span>
    </div>
  )
}

export default LogoutButton
