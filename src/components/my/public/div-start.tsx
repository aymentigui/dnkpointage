"use client"
import { verifySession } from '@/actions/permissions';
import { useSession } from '@/hooks/use-session';
import React, { useEffect, useState } from 'react'

const DivStart = () => {
    const { setSession, session } = useSession()
    useEffect(() => {
        verifySession().then((res) => {
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

export default DivStart
