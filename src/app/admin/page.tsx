import React from 'react'
import { useTranslations } from 'next-intl';

const AdminPage = () => {
  const t = useTranslations('Index');

  return (
    <div>
      <h1>{t('title')}</h1>
    </div >
  )
}

export default AdminPage