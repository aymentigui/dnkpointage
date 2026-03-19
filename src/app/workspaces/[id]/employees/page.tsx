'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { EmployeeTable } from '@/components/employees/EmployeeTable'
import { EmployeeFilters } from '@/components/employees/EmployeeFilters'
import { EmployeeStats } from '@/components/employees/EmployeeStats'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users, RefreshCw } from 'lucide-react'
import { employeesApi, cyclesApi } from '@/lib/api'
import { toast } from 'react-hot-toast'
import { Skeleton } from '@/components/ui/skeleton'

export default function EmployeesPage() {
    const params = useParams()
    const router = useRouter()
    const workspaceId = params.id as string

    const [employees, setEmployees] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState({
        search: '',
        zone: '',
        type: 'all',
        minAbsence: ''
    })

    useEffect(() => {
        loadEmployees()
    }, [workspaceId])

    const loadEmployees = async () => {
        try {
            const { data } = await employeesApi.getAll({ workspace_id: workspaceId })
            setEmployees(data.data || [])
        } catch (error) {
            toast.error('Erreur lors du chargement')
        } finally {
            setLoading(false)
        }
    }

    const handleDetectCycles = async () => {
        try {
            await cyclesApi.detect(workspaceId)
            toast.success('Détection des cycles lancée')
            loadEmployees()
        } catch (error) {
            toast.error('Erreur')
        }
    }

    const filteredEmployees = employees.filter(emp => {
        if (filters.search) {
            const searchLower = filters.search.toLowerCase()
            const match =
                emp.matricule.toLowerCase().includes(searchLower) ||
                emp.nom?.toLowerCase().includes(searchLower) ||
                emp.prenom?.toLowerCase().includes(searchLower) ||
                emp.poste?.toLowerCase().includes(searchLower)
            if (!match) return false
        }
        if (filters.zone && emp.zone !== filters.zone) return false
        return true
    })

    return (
        <AppShell workspaceName="Employés" onDashboardClick={() => router.push(`/workspaces/${workspaceId}`)}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => router.back()} className="w-fit">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Retour
                    </Button>
                    <Button variant="outline" onClick={handleDetectCycles}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Détecter cycles
                    </Button>
                </div>

                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Users className="h-8 w-8" />
                        Employés
                    </h1>
                    <p className="text-muted-foreground">
                        {filteredEmployees.length} employé(s) trouvé(s)
                    </p>
                </div>

                <EmployeeStats employees={filteredEmployees} />

                <EmployeeFilters filters={filters} setFilters={setFilters} />

                {loading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : (
                    <EmployeeTable
                        employees={filteredEmployees}
                        workspaceId={workspaceId}
                        onUpdate={loadEmployees}
                    />
                )}
            </div>
        </AppShell>
    )
}