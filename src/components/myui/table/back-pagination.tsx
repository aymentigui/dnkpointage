import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import React from 'react';

const BackPagination = ({ page, setPage, searchQuery, isLoading, pageSize }: any) => {
    const router = useRouter();
    const pathname = usePathname(); // Utilisation de usePathname pour obtenir le chemin actuel
    const searchParams = useSearchParams(); // Utilisation de useSearchParams pour accéder aux paramètres de recherche
    const s = useTranslations("System");

    const handleBackPage = () => {
        const prevPage = Math.max(page - 1, 1);
        setPage(prevPage);

        // Manipulation des paramètres de recherche pour la pagination
        const params = new URLSearchParams(searchParams.toString()); // Convertir les searchParams en URLSearchParams
        params.set("page", prevPage.toString());

        if (searchQuery && searchQuery !== "") {
            params.set("search", searchQuery);
        }

        // Redirection avec la nouvelle URL incluant les paramètres de pagination et de recherche
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <Button
            variant="outline"
            size="sm"
            className={cn(
                pageSize === 0 ? "hidden" : "block",
                page === 1 ? "cursor-not-allowed" : ""
            )}
            onClick={handleBackPage}
            disabled={page === 1 || page===0 || isLoading}
        >
            {s("back")}
        </Button>
    );
};

export default BackPagination;
