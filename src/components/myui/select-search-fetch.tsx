import React, { useState } from 'react'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../ui/select'
import { useTranslations } from 'next-intl'

interface SelectSFetchProps {
    label: string
    placeholder: string
    value: string
    onChange: (value: string) => void
    options: { value: string, label: string }[]
}

const SelectSearchFetch = ({
    label,
    placeholder,
    value,
    onChange,
    options
}: SelectSFetchProps) => {
    const translate = useTranslations("System")
    const [searchQuery, setSearchQuery] = useState<string>('')

    // Filtrer les options en fonction du texte de recherche
    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <Select value={value} onValueChange={(value) => onChange(value)}>
            <SelectGroup>
                <SelectLabel>{label ?? translate("options")}</SelectLabel>
            </SelectGroup>
            <SelectTrigger>
                <SelectValue placeholder={placeholder ?? translate("selectoption")} />
            </SelectTrigger>
            <SelectContent>
                {/* Ajout d'un champ de recherche */}
                <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-md mb-2"
                    placeholder={translate("search")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {/* Affichage des options filtrées */}
                {filteredOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
                <SelectItem value="0">{translate("all")}</SelectItem>
            </SelectContent>
        </Select>
    )
}

export default SelectSearchFetch
