import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext.jsx';

/**
 * Consistent "← Back" control for the top-right of every page header
 * (FR-06 / FR-07 / FR-10). Navigates to the previous entry in the browser's
 * session history by default, falling back to the Dashboard if there is no
 * previous page in the current session (e.g. after a direct link or a
 * refresh, where window.history has nowhere useful to go).
 *
 * fallbackTo: dashboard path to fall back to (defaults to "/").
 */
export default function BackButton({ fallbackTo = '/' }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleBack = () => {
    // history.state.idx is set by React Router - greater than 0 means there is
    // somewhere in *this session* to go back to. Otherwise (e.g. a bookmarked
    // link or a hard refresh landed us here first), go to the Dashboard.
    const hasHistory = window.history.state && window.history.state.idx > 0;
    if (hasHistory) {
      navigate(-1);
    } else {
      navigate(fallbackTo);
    }
  };

  return (
    <button type="button" className="btn btn-ghost back-btn" onClick={handleBack}>
      {t('common.back')}
    </button>
  );
}
