'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck, UserX, Clock, Award } from 'lucide-react'

interface EmployeeStatsProps {
    employees: any[]
}

export function EmployeeStats({ employees }: EmployeeStatsProps) {
    const stats = {
        total: employees.length,
        avecCycle: employees.filter(e => e.cycles && e.cycles.type !== 'unknown').length,
        sansCycle: employees.filter(e => !e.cycles || e.cycles.type === 'unknown').length,
        avecZone: employees.filter(e => e.zone).length,
        zones: new Set(employees.map(e => e.zone).filter(Boolean)).size,
    }

    const cards = [
        {
            title: 'Total',
            value: stats.total,
            icon: Users,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
        },
        {
            title: 'Avec cycle',
            value: stats.avecCycle,
            icon: Award,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
        },
        {
            title: 'Sans cycle',
            value: stats.sansCycle,
            icon: Clock,
            color: 'text-yellow-500',
            bg: 'bg-yellow-500/10',
        },
        {
            title: 'Zones',
            value: stats.zones,
            icon: UserCheck,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
        },
    ]

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map((card, i) => (
                <Card key={i}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                        <div className={`p-2 rounded-full ${card.bg}`}>
                            <card.icon className={`h-4 w-4 ${card.color}`} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{card.value}</div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}