// import { AddUpdateUserDialogProvider } from '@/context/add-update-dialog-context'
// import { AddUpdateUserDialog } from '@/modals/add-update-dialog'
import React from 'react'

const ModalContext = ({ children }: { children: React.ReactNode }) => {
    return (
        <>
            {/* <exemple de contect provider> */}
                {children}
                {/* <exemple de modal /> */}
            {/* </exemple de contect provider> */}
        </>
    )
}

export default ModalContext
