import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react'

const NextPagination = ({ page, setPage, count, pageSize, isLoading, searchQuery }: any) => {
    const router=useRouter()
    const s = useTranslations("System")
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const handleNextPage = () => {
        const nextPage = page + 1;
        setPage(nextPage);

        // Construire les nouveaux paramètres de recherche avec le page et search
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", nextPage.toString());

        if (searchQuery && searchQuery !== "") {
            params.set("search", searchQuery);
        }

        // Redirection avec les nouveaux paramètres
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={pageSize === 0 || page === Math.ceil(count / pageSize) || count ===0 || isLoading}
        >
            {s("next")}
        </Button>
    )
}

export default NextPagination
