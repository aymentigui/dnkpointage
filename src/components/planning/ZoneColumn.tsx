'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ZoneColumnProps {
    zone?: string
}

export function ZoneColumn({ zone }: ZoneColumnProps) {
    if (!zone) {
        return <span className="text-muted-foreground text-xs">—</span>
    }

    // Tronquer la zone si trop longue
    const displayZone = zone.length > 10 ? zone.substring(0, 8) + '...' : zone

    // Générer une couleur basée sur la zone
    const getZoneColor = (zone: string) => {
        const colors = [
            'bg-blue-500/10 text-blue-500 border-blue-500/20',
            'bg-green-500/10 text-green-500 border-green-500/20',
            'bg-purple-500/10 text-purple-500 border-purple-500/20',
            'bg-orange-500/10 text-orange-500 border-orange-500/20',
            'bg-pink-500/10 text-pink-500 border-pink-500/20',
            'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
        ]
        const hash = zone.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        return colors[hash % colors.length]
    }

    return (
        <Badge
            variant="outline"
            className={cn('font-mono text-xs px-1 max-w-[70px] truncate', getZoneColor(zone))}
            title={zone} // Tooltip pour voir la zone complète
        >
            {displayZone}
        </Badge>
    )
}