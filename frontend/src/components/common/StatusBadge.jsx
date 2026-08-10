import React from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';

export default function StatusBadge({ status }) {
  const { t } = useLanguage();
  const cls = status === 'Paid' ? 'badge badge-paid' : 'badge badge-pending';
  const label = status === 'Paid' ? t('billing.paid') : t('billing.pending');
  return <span className={cls}>{label}</span>;
}
