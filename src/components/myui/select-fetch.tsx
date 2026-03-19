import React from 'react'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../ui/select'
import { useTranslations } from 'next-intl'

interface SelectFetchProps {
    label: string
    placeholder: string
    value: string
    onChange: (value: string) => void,
    options: {value: string, label: string}[]
}
const SelectFetch = ({
    label,
    placeholder,
    value,
    onChange,
    options
}: SelectFetchProps) => {
    const translate = useTranslations("System")

    return (
        <Select value={value} onValueChange={(value) => onChange(value)}>
            <SelectGroup>
                <SelectLabel>{label??translate("options")}</SelectLabel>
            </SelectGroup>
            <SelectTrigger>
                <SelectValue placeholder={placeholder??translate("selectoption")} />
            </SelectTrigger>
            <SelectContent>
                {options.map((options) => (<SelectItem key={options.value} value={options.value}>{options.label}</SelectItem>))}
                <SelectItem value="0">{translate("all")}</SelectItem>
            </SelectContent>
        </Select>
    )
}

export default SelectFetch
