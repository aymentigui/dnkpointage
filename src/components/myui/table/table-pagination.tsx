import React from 'react'
import BackPagination from './back-pagination'
import NextPagination from './next-pagination'

const TablePagination = (
    { page, setPage, count, pageSize, isLoading, debouncedSearchQuery }: any
) => {
    return (
        <div className="flex items-center justify-end space-x-2 py-4">
            <BackPagination page={page} setPage={setPage} pageSize={pageSize} searchQuery={debouncedSearchQuery} isLoading={isLoading} />
            <NextPagination page={page} setPage={setPage} count={count} pageSize={pageSize} isLoading={isLoading} searchQuery={debouncedSearchQuery} />
        </div>
    )
}

export default TablePagination
