import { useEffect, useState } from 'react';

import type { BackupPayload, ImportBatchRecord, ImportResult } from '@trade-journal/shared';

import { savedViewsStorageKey } from '../components/FilterBar';
import { exportBackup, getImportHistory, importTransactions, restoreBackup } from '../lib/api';

type BackupFile = BackupPayload & {
  client?: {
    savedViews?: unknown;
  };
};

function downloadJson(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ImportsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<ImportBatchRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  async function loadHistory() {
    const response = await getImportHistory();
    setHistory(response.items);
  }

  useEffect(() => {
    loadHistory().catch(() => {
      setHistory([]);
    });
  }, []);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Google Sheets CSV workflow</p>
          <h2>Imports</h2>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {backupMessage && <div className="empty-state compact-empty">{backupMessage}</div>}

      <section className="panel upload-panel">
        <div className="panel-header">
          <h3>Upload a CSV export</h3>
          <span className="muted">Import errors will be reported after processing</span>
        </div>
        <label className="upload-dropzone">
          <span>{selectedFile ? selectedFile.name : 'Select a CSV file from Google Sheets'}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setResult(null);
              setError(null);
            }}
          />
        </label>
        <div className="toolbar">
          <button
            className="primary-button"
            disabled={!selectedFile || isUploading}
            onClick={async () => {
              if (!selectedFile) {
                return;
              }

              setIsUploading(true);
              try {
                const csvText = await selectedFile.text();
                const importResult = await importTransactions(selectedFile.name, csvText);
                setResult(importResult);
                await loadHistory();
                setError(null);
              } catch (requestError) {
                setError(requestError instanceof Error ? requestError.message : 'Import failed.');
              } finally {
                setIsUploading(false);
              }
            }}
            type="button"
          >
            {isUploading ? 'Importing…' : 'Import CSV'}
          </button>
        </div>
        <div className="metric-list">
          <div>
            <span>Expected headers</span>
            <strong>Date, Expiration, Close Date, Stock, Strategy x2, Strikes...</strong>
          </div>
          <div>
            <span>Deduping</span>
            <strong>Stable trade matching with updated-row refresh</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>Rows are deduped by fingerprint, then errors are reported after import</strong>
          </div>
        </div>
      </section>

      <section className="panel upload-panel">
        <div className="panel-header">
          <h3>Backup and restore</h3>
          <span className="muted">Exports transactions, imports, daily reviews, and saved views</span>
        </div>
        <div className="metric-list">
          <div>
            <span>Backup contents</span>
            <strong>Database records plus browser saved views</strong>
          </div>
          <div>
            <span>Restore behavior</span>
            <strong>Replaces the current journal with the uploaded backup</strong>
          </div>
        </div>
        <div className="toolbar split-toolbar">
          <button
            className="primary-button"
            onClick={async () => {
              try {
                const backup = await exportBackup();
                const savedViewsRaw = window.localStorage.getItem(savedViewsStorageKey);
                const backupWithClient: BackupFile = {
                  ...backup,
                  client: {
                    savedViews: savedViewsRaw ? JSON.parse(savedViewsRaw) : {}
                  }
                };
                downloadJson(`trade-journal-backup-${new Date().toISOString().slice(0, 10)}.json`, backupWithClient);
                setBackupMessage('Backup exported.');
                setError(null);
              } catch (requestError) {
                setError(requestError instanceof Error ? requestError.message : 'Backup export failed.');
              }
            }}
            type="button"
          >
            Export Backup
          </button>
          <label className="ghost-button file-button">
            Select backup
            <input
              accept="application/json,.json"
              type="file"
              onChange={(event) => {
                setRestoreFile(event.target.files?.[0] ?? null);
                setBackupMessage(null);
              }}
            />
          </label>
          <button
            className="ghost-button danger-button"
            disabled={!restoreFile || isRestoring}
            onClick={async () => {
              if (!restoreFile) {
                return;
              }

              setIsRestoring(true);
              try {
                const parsed = JSON.parse(await restoreFile.text()) as BackupFile;
                const restoreResult = await restoreBackup(parsed);
                if (parsed.client?.savedViews) {
                  window.localStorage.setItem(savedViewsStorageKey, JSON.stringify(parsed.client.savedViews));
                }
                setBackupMessage(
                  `Restored ${restoreResult.importedTransactions} trades, ${restoreResult.importedBatches} import batches, and ${restoreResult.importedDailyReviews} daily reviews.`
                );
                await loadHistory();
                setError(null);
              } catch (requestError) {
                setError(requestError instanceof Error ? requestError.message : 'Restore failed.');
              } finally {
                setIsRestoring(false);
              }
            }}
            type="button"
          >
            {isRestoring ? 'Restoring...' : 'Restore Backup'}
          </button>
        </div>
        {restoreFile && <p className="muted selected-file-name">{restoreFile.name}</p>}
      </section>

      {result && (
        <section className="panel upload-panel">
          <div className="panel-header">
            <h3>Import result</h3>
            <span className="muted">{result.sourceFileName}</span>
          </div>
          <div className="metric-list">
            <div>
              <span>Imported</span>
              <strong>{result.imported}</strong>
            </div>
            <div>
              <span>Updated</span>
              <strong>{result.updated}</strong>
            </div>
            <div>
              <span>Skipped duplicates</span>
              <strong>{result.skippedDuplicates}</strong>
            </div>
            <div>
              <span>Errors</span>
              <strong>{result.errors.length}</strong>
            </div>
          </div>
          {result.errors.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {result.errors.map((item) => (
                  <tr key={`${item.rowNumber}-${item.message}`}>
                    <td>{item.rowNumber}</td>
                    <td>{item.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section className="panel upload-panel">
        <div className="panel-header">
          <h3>Import history</h3>
          <button
            className="ghost-button"
            onClick={async () => {
              try {
                await loadHistory();
                setError(null);
              } catch (requestError) {
                setError(requestError instanceof Error ? requestError.message : 'Failed to load import history.');
              }
            }}
            type="button"
          >
            Refresh
          </button>
        </div>
        {history.length === 0 ? (
          <div className="empty-state compact-empty">No import batches loaded yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Imported</th>
                <th>File</th>
                <th>Rows</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {history.map((batch) => (
                <tr key={batch.id}>
                  <td>{new Date(batch.importedAt).toLocaleString()}</td>
                  <td>{batch.sourceFileName}</td>
                  <td>{batch.rowCount}</td>
                  <td>{batch.errorCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
