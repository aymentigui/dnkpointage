import React from 'react'
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}
const Pagination = ({
    currentPage,
    totalPages,
    onPageChange
}: PaginationProps) => {
    return (
        <div className='flex items-center space-x-2'>
            <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
            >
                Précédent
            </Button>
            <span className={cn("text-sm", "mx-2")}>
                Page {currentPage} sur {totalPages}
            </span>
            <Button
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
            >
                Suivant
            </Button>
        </div>
    )
}

export default Pagination
