"use client"
import { useTranslations } from 'next-intl'
import React from 'react'

const MyDialogConfirm = ({ onConfirm, onClose, message}: any) => {
    const translate=useTranslations("System")

    return (
        <div className="absolute z-50 inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-md max-w-[400px] shadow-lg">
                <p>{message??translate("confermationdeletemessage")}</p>
                <div className="flex gap-4 mt-4">
                    <button
                        onClick={onConfirm}
                        className="bg-red-500 text-white py-2 px-4 rounded-md"
                    >
                        {translate("confermationdelete")}
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-gray-300 text-black py-2 px-4 rounded-md"
                    >
                        {translate("cancel")}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default MyDialogConfirm
