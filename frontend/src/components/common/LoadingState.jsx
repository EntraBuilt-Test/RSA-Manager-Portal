import React from 'react';
import useSlowLoading from '../../hooks/useSlowLoading.js';

/**
 * Drop-in replacement for the bare `<div className="page-loading">Loading...</div>`
 * pattern used across the list screens. Adds two things that pattern didn't
 * have: a "still loading, the server may be waking up" notice once a fetch
 * has been pending a few seconds (see useSlowLoading), and a visible error +
 * Retry button instead of a spinner that silently never resolves when a
 * request actually fails (timeout, network error, etc.).
 *
 * Usage: replace `{loading && <div className="page-loading">Loading...</div>}`
 * with `<LoadingState loading={loading} error={error} onRetry={load} />`,
 * and it renders nothing once loading is false and there's no error.
 */
export default function LoadingState({ loading, error, onRetry }) {
  const slow = useSlowLoading(loading);

  if (loading) {
    return (
      <div className="page-loading">
        {slow ? 'Still loading... the server may be waking up, this can take up to a minute.' : 'Loading...'}
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        {error}
        {onRetry && (
          <button type="button" className="btn btn-sm btn-ghost" style={{ marginLeft: 10 }} onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  return null;
}
