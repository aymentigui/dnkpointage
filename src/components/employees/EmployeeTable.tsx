'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MoreHorizontal, Eye, Edit, Calendar, FileText } from 'lucide-react'
import { getAnnotColor } from '@/lib/utils'
import { CycleModal } from '../modals/CycleModal'

interface EmployeeTableProps {
    employees: any[]
    workspaceId: string
    onUpdate: () => void
}

export function EmployeeTable({ employees, workspaceId, onUpdate }: EmployeeTableProps) {
    const router = useRouter()
    const [openCycleModal, setOpenCycleModal] = useState(false)
    const [selectedMatricule, setSelectedMatricule] = useState<string | null>(null)
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
    const [currentCycle, setCurrentCycle] = useState<any>(null)

    const handleSuccesUpdateCycle = () => {
        setOpenCycleModal(false)
        onUpdate()
    }

    const getInitials = (nom?: string, prenom?: string) => {
        if (!nom && !prenom) return '??'
        return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase()
    }

    const getCycleBadge = (cycle: any) => {
        if (!cycle) return <Badge variant="outline">?</Badge>

        if (cycle.type === 'weekly') {
            let days = JSON.parse(cycle.rest_days || '[]')
            if (typeof days === 'string') {
                days = JSON.parse(days)
            }
            return <Badge style={{ backgroundColor: '#c8f56420', color: '#c8f564' }}>
                Repos: {days && days.map((d: number) => ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'][d]).join('+')}
            </Badge>
        }
        if (cycle.type === 'rotation') {
            return <Badge style={{ backgroundColor: '#6488f520', color: '#6488f5' }}>
                {cycle.travail}T/{cycle.repos}R
            </Badge>
        }
        if (cycle.type === 'night') {
            return <Badge style={{ backgroundColor: '#f5a06420', color: '#f5a064' }}>
                Nuit {cycle.travail}T/{cycle.repos}R
            </Badge>
        }
        return <Badge variant="outline">Inconnu</Badge>
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Prénom</TableHead>
                        <TableHead>Poste</TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead>Cycle</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {employees.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                Aucun employé trouvé
                            </TableCell>
                        </TableRow>
                    ) : (
                        employees.map((emp) => (
                            <TableRow key={emp.id}>
                                <TableCell>
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback style={{ backgroundColor: getAnnotColor(emp.cycles?.type || 'unknown') }}>
                                            {getInitials(emp.nom, emp.prenom)}
                                        </AvatarFallback>
                                    </Avatar>
                                </TableCell>
                                <TableCell className="font-medium">{emp.matricule}</TableCell>
                                <TableCell>{emp.nom || '-'}</TableCell>
                                <TableCell>{emp.prenom || '-'}</TableCell>
                                <TableCell>{emp.poste || '-'}</TableCell>
                                <TableCell>
                                    {emp.zone ? (
                                        <Badge variant="secondary">{emp.zone}</Badge>
                                    ) : '-'}
                                </TableCell>
                                <TableCell>{getCycleBadge(emp.cycles)}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => router.push(`/workspaces/${workspaceId}/employees/${emp.id}`)}>
                                                <Eye className="h-4 w-4 mr-2" /> Détail
                                            </DropdownMenuItem>
                                            {/* <DropdownMenuItem onClick={() => router.push(`/workspaces/${workspaceId}/planning?matricule=${emp.matricule}`)}>
                                                <Calendar className="h-4 w-4 mr-2" /> Planning
                                            </DropdownMenuItem> */}
                                            <DropdownMenuItem onClick={() => {
                                                setSelectedMatricule(emp.matricule)
                                                setSelectedEmployeeId(emp.id)
                                                setCurrentCycle(emp.cycles)
                                                setOpenCycleModal(true)
                                            }}>
                                                <Edit className="h-4 w-4 mr-2" /> Modifier
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            <CycleModal
                open={openCycleModal}
                onOpenChange={setOpenCycleModal}
                employeeId={selectedEmployeeId ?? ''}
                employeeMatricule={selectedMatricule ?? ''}
                currentCycle={currentCycle}
                onSuccess={handleSuccesUpdateCycle}
            />
        </div>
    )
}