import React from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger }) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
