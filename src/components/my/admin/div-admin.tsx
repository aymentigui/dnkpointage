"use client"
import { haveSession } from '@/actions/permissions';
import { useSession } from '@/hooks/use-session';
import React, { useEffect, useState } from 'react'

const DivAdmin = () => {
    const { setSession, session } = useSession()
    useEffect(() => {
        haveSession().then((res) => {
            if (res) {
                if (!session.user)
                    setSession(res)
            }
            else {
                setSession({})
            }
        });
    }, [])
    return (
        <>
        </>
    )
}

export default DivAdmin
