'use client'

import React, { useState, useEffect } from 'react'
import { Skeleton } from "@/components/ui/skeleton"
import { ImageIcon, AlertCircle, CircleUserRound, LucideProps } from 'lucide-react'
import { cn } from "@/lib/utils"

interface BeautifulImageProps {
  src: string | null
  alt: string
  className?: string,
  objet_fit?: string,
  avatar?: boolean,
  load? : boolean,
  Icon?: React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>
}

export const LzyImage: React.FC<BeautifulImageProps> = ({ src, alt, className, objet_fit, avatar = false, Icon, load }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (src) {
      const img = new Image()
      img.src = src
      img.onload = () => setLoading(false)
      img.onerror = () => {
        setLoading(false)
        setError(true)
      }
    } else if(load){
      setLoading(true)
    } else {
      setLoading(false)
    }
  }, [src])

  if (error) {
    return (
      <div className={cn("flex items-center justify-center bg-red-100 text-red-500", className)}>
        <AlertCircle className="w-1/3 h-1/3" />
      </div>
    )
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Skeleton className="w-full h-full">
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <ImageIcon className="w-1/3 h-1/3 text-muted-foreground animate-pulse" />
            </div>
          </Skeleton>
        </div>
      )}
      {!loading && !error && src && <img
        src={src}
        alt={alt}
        className={cn(
          `w-full h-full ${objet_fit ? objet_fit : "object-cover"} transition-all duration-500 ease-in-out`,
          loading ? "scale-110 blur-2xl" : "scale-100 blur-0"
        )}
      />}
      {!src && !avatar && !Icon && <ImageIcon
        className={cn(
          `w-full h-full ${objet_fit ? objet_fit : "object-cover"} transition-all duration-500 ease-in-out`,
          loading ? "scale-110 blur-2xl" : "scale-100 blur-0"
        )}
      />}
      {!src && avatar && !Icon && <CircleUserRound
        className={cn(
          `w-full h-full ${objet_fit ? objet_fit : "object-cover"} transition-all duration-500 ease-in-out`,
          loading ? "scale-110 blur-2xl" : "scale-100 blur-0"
        )}
      />}
      {Icon && <Icon
        className={cn(
          `w-full h-full ${objet_fit ? objet_fit : "object-cover"} transition-all duration-500 ease-in-out`,
          loading ? "scale-110 blur-2xl" : "scale-100 blur-0"
        )}
      />}
    </div>
  )
}
