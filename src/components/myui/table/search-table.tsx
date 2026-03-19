import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';

const SearchTable = ({ setPage, page, debouncedSearchQuery, setDebouncedSearchQuery }: any) => {
    const router = useRouter();
    const pathname = usePathname(); // Utilisation de usePathname pour obtenir le chemin actuel
    const searchParams = useSearchParams(); // Utilisation de useSearchParams pour accéder aux paramètres de recherche
    const s = useTranslations("System");
    const [searchQuery, setSearchQuery] = useState(debouncedSearchQuery ?? "");

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);

            const params = new URLSearchParams(searchParams.toString()); // Convertir les searchParams en URLSearchParams
            if ((searchQuery && searchQuery !== "")|| (searchQuery === "" && searchParams.get("search"))) {
                params.set("page", "1"); // Assurez-vous d'inclure le paramètre "page"
            }
            params.set("search", searchQuery); // Ajoutez le paramètre "search" si nécessaire
            
            if (searchQuery==="" && searchParams.get("search")=== null || searchParams.get("search") === "") {
                params.delete("search");  
            }
            router.push(`${pathname}?${params.toString()}`);
        }, 500); 

        return () => {
            clearTimeout(handler); 
        };
    }, [searchQuery, page, searchParams, setDebouncedSearchQuery, router, pathname]);

    return (
        <Input
            placeholder={s("search")}
            value={searchQuery} // Utiliser searchQuery au lieu de globalFilter
            onChange={(event) => {
                setSearchQuery(event.target.value); // Mettre à jour searchQuery
            }}
            className="max-w-sm mb-4"
        />
    );
};

export default SearchTable;
