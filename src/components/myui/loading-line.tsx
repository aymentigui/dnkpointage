import { getTranslations } from 'next-intl/server'
import React from 'react'

const Loading = async () => {
    const s = await getTranslations("System")

    return (
        <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">{s("loading")}</p>
            <div className="mt-2 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 animate-pulse"></div>
            </div>
        </div>
    )
}

export default Loading
