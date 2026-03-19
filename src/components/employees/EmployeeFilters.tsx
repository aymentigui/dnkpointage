'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

interface EmployeeFiltersProps {
    filters: {
        search: string
        zone: string
        type: string
        minAbsence: string
    }
    setFilters: (filters: any) => void
}

export function EmployeeFilters({ filters, setFilters }: EmployeeFiltersProps) {
    const handleChange = (key: string, value: string) => {
        setFilters({ ...filters, [key]: value })
    }

    const clearFilters = () => {
        setFilters({
            search: '',
            zone: '',
            type: 'all',
            minAbsence: ''
        })
    }

    return (
        <div className="bg-card rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Recherche */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher..."
                        value={filters.search}
                        onChange={(e) => handleChange('search', e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Zone */}
                <Input
                    placeholder="Filtrer par zone..."
                    value={filters.zone}
                    onChange={(e) => handleChange('zone', e.target.value)}
                />

                {/* Type de filtrage */}
                <Select value={filters.type} onValueChange={(v) => handleChange('type', v)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Afficher" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous les employés</SelectItem>
                        <SelectItem value="hasAbsence">Avec absences</SelectItem>
                        <SelectItem value="noAbsence">Sans absence</SelectItem>
                    </SelectContent>
                </Select>

                {/* Absences minimum */}
                <Input
                    type="number"
                    placeholder="Absences min..."
                    value={filters.minAbsence}
                    onChange={(e) => handleChange('minAbsence', e.target.value)}
                    min={0}
                />
            </div>

            {/* Bouton clear */}
            {(filters.search || filters.zone || filters.type !== 'all' || filters.minAbsence) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full md:w-auto">
                    <X className="h-4 w-4 mr-2" />
                    Effacer les filtres
                </Button>
            )}
        </div>
    )
}