import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  MessageSquareText,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { CSVColumnMapping, MerchantRule, Transaction } from '../types';
import {
  detectCSVColumns,
  parseCSVTransactions,
  parseSMSAlerts,
} from '../utils/parser';
import { SAMPLE_CSV_SNIPPET, SAMPLE_SMS_SNIPPET } from '../utils/sampleData';
import {
  exportTransactionsCSV,
  formatCurrency,
  triggerDownload,
} from '../utils/storage';

interface ImportPrivacyViewProps {
  transactions: Transaction[];
  rules: MerchantRule[];
  onImportTransactions: (
    newTransactions: Transaction[],
    stats: { duplicatesSkipped: number; redactedPIIItems: number }
  ) => void;
  onLoadSampleData: () => void;
  onClearAllData: () => void;
}

export const ImportPrivacyView: React.FC<ImportPrivacyViewProps> = ({
  transactions,
  rules,
  onImportTransactions,
  onLoadSampleData,
  onClearAllData,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // CSV Mapper State
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<CSVColumnMapping>({
    dateCol: '',
    descriptionCol: '',
    debitCol: '',
    creditCol: '',
    amountCol: '',
    typeCol: '',
    accountCol: '',
  });
  const [csvAccountLabel, setCsvAccountLabel] = useState('Bank CSV');

  // SMS Parser State
  const [smsInput, setSmsInput] = useState('');

  // Feedback & Confirmations
  const [importFeedback, setImportFeedback] = useState<{
    added: number;
    duplicates: number;
    redacted: number;
    errors: string[];
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const existingKeys = useMemo(
    () => new Set(transactions.map((t) => t.compositeKey)),
    [transactions]
  );

  const totalRedactedInLedger = useMemo(
    () => transactions.reduce((s, t) => s + (t.redactedCount || 0), 0),
    [transactions]
  );

  const handleCSVContent = (text: string, filename?: string) => {
    const detected = detectCSVColumns(text);
    setCsvHeaders(detected.headers);
    setCsvRows(detected.rows);
    setMapping(detected.suggestedMapping);
    if (filename) {
      setCsvAccountLabel(filename.replace(/\.csv$/i, '').slice(0, 24));
    }
    setImportFeedback(null);
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result ?? '');
      handleCSVContent(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleImportCSV = () => {
    const result = parseCSVTransactions(
      csvHeaders,
      csvRows,
      mapping,
      existingKeys,
      rules,
      csvAccountLabel
    );
    onImportTransactions(result.transactions, {
      duplicatesSkipped: result.duplicatesSkipped,
      redactedPIIItems: result.redactedPIIItems,
    });
    setImportFeedback({
      added: result.transactions.length,
      duplicates: result.duplicatesSkipped,
      redacted: result.redactedPIIItems,
      errors: result.errors,
    });
    if (result.transactions.length > 0) {
      setCsvHeaders([]);
      setCsvRows([]);
    }
  };

  const handleImportSMS = () => {
    if (!smsInput.trim()) return;
    const result = parseSMSAlerts(smsInput, existingKeys, rules);
    onImportTransactions(result.transactions, {
      duplicatesSkipped: result.duplicatesSkipped,
      redactedPIIItems: result.redactedPIIItems,
    });
    setImportFeedback({
      added: result.transactions.length,
      duplicates: result.duplicatesSkipped,
      redacted: result.redactedPIIItems,
      errors: result.errors,
    });
    if (result.transactions.length > 0) {
      setSmsInput('');
    }
  };

  const smsPreview = useMemo(() => {
    if (!smsInput.trim()) return [];
    return parseSMSAlerts(smsInput, existingKeys, rules).transactions;
  }, [smsInput, existingKeys, rules]);

  const handleExportCSV = () => {
    const csv = exportTransactionsCSV(transactions);
    triggerDownload(
      `spendsense-export-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      'text/csv;charset=utf-8;'
    );
  };

  const handleExportJSON = () => {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        transactionCount: transactions.length,
        rules,
        transactions,
      },
      null,
      2
    );
    triggerDownload(
      `spendsense-backup-${new Date().toISOString().slice(0, 10)}.json`,
      payload,
      'application/json'
    );
  };

  return (
    <div className="space-y-6">
      {/* Privacy Architecture Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Local-First Import &amp; Data Privacy Center
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Zero bank logins, zero external tracking, zero cloud uploads.
                Every CSV statement and SMS alert is parsed locally in your
                browser. 12–16 digit card numbers, account numbers, PANs, and
                OTPs are automatically masked via regex before saving to local
                storage.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-xs text-slate-500 sm:text-right">
            <p className="font-mono font-medium text-slate-900 tabular-nums">
              {transactions.length} records stored locally
            </p>
            <p className="mt-0.5 font-mono tabular-nums">
              {totalRedactedInLedger} PII tokens masked
            </p>
          </div>
        </div>
      </div>

      {/* Import Result Feedback */}
      {importFeedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <span>
              Imported {importFeedback.added} new transaction
              {importFeedback.added === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-800">
            {importFeedback.duplicates} duplicate
            {importFeedback.duplicates === 1 ? '' : 's'} skipped via composite
            key
            <span aria-hidden="true"> · </span>
            {importFeedback.redacted} sensitive PII field
            {importFeedback.redacted === 1 ? '' : 's'} automatically masked
          </p>
          {importFeedback.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">
              {importFeedback.errors.slice(0, 4).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* A. CSV Statement Parser */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-teal-700" />
              <h3 className="text-base font-semibold text-slate-900">
                CSV Statement Parser
              </h3>
            </div>
            <button
              type="button"
              onClick={() => handleCSVContent(SAMPLE_CSV_SNIPPET, 'Sample CSV')}
              className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap"
            >
              Try sample CSV
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Upload any bank or card CSV export. Map columns below before
            importing.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className={`mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors ${
              isDragging
                ? 'border-teal-600 bg-teal-50/50'
                : 'border-slate-300 bg-slate-50/70'
            }`}
          >
            <Upload className="h-6 w-6 text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700">
              Drop bank statement CSV here
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Processed 100% offline in browser memory
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Choose CSV File
            </button>
          </div>

          {csvHeaders.length > 0 && (
            <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900">
                  Column Mapping ({csvRows.length} rows detected)
                </h4>
                <input
                  type="text"
                  value={csvAccountLabel}
                  onChange={(e) => setCsvAccountLabel(e.target.value)}
                  placeholder="Account label"
                  aria-label="Default account label"
                  className="w-36 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                {(
                  [
                    ['dateCol', 'Date *'],
                    ['descriptionCol', 'Description / Narration *'],
                    ['debitCol', 'Debit / Withdrawal'],
                    ['creditCol', 'Credit / Deposit'],
                    ['amountCol', 'Single Amount (optional)'],
                    ['accountCol', 'Account Column (optional)'],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="space-y-1">
                    <span className="block font-medium text-slate-600">
                      {label}
                    </span>
                    <select
                      value={mapping[field]}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          [field]: e.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
                    >
                      <option value="">-- Not mapped --</option>
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCsvHeaders([]);
                    setCsvRows([]);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportCSV}
                  className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Import &amp; Deduplicate
                </button>
              </div>
            </div>
          )}
        </section>

        {/* B. Paste SMS / Notification Alert Parser */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-teal-700" />
              <h3 className="text-base font-semibold text-slate-900">
                Paste SMS / Notification Alert
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSmsInput(SAMPLE_SMS_SNIPPET)}
              className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap"
            >
              Insert sample SMS
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Paste one or multiple bank SMS alerts (one per line). Extracts
            amount, date, and merchant automatically.
          </p>

          <textarea
            value={smsInput}
            onChange={(e) => setSmsInput(e.target.value)}
            rows={5}
            placeholder='e.g. Rs. 1,450.00 debited from A/c XX4821 on 22-11-26 at ZOMATO UPI Ref 632819'
            className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
          />

          {smsPreview.length > 0 && (
            <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50 px-3">
              {smsPreview.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-slate-900">
                      {tx.normalizedMerchant}
                    </span>
                    <span className="text-slate-400" aria-hidden="true">
                      {' '}
                      ·{' '}
                    </span>
                    <span className="text-slate-600">{tx.category}</span>
                    <span className="text-slate-400" aria-hidden="true">
                      {' '}
                      ·{' '}
                    </span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {tx.date}
                    </span>
                  </div>
                  <span className="ml-3 shrink-0 font-mono font-medium text-slate-900 tabular-nums">
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={!smsInput.trim()}
              onClick={handleImportSMS}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
            >
              Parse &amp; Add to Ledger
            </button>
          </div>
        </section>
      </div>

      {/* Data Portability & Local Reset Controls */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">
          Portability &amp; Local Storage Controls
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Export a clean, PII-redacted copy of your ledger or reset local
          browser state at any time.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={transactions.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Clean CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            disabled={transactions.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export JSON Backup</span>
          </button>

          <button
            type="button"
            onClick={onLoadSampleData}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Load Sample Demo Data</span>
          </button>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear All Local Data</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs">
              <span className="font-medium text-red-800">
                Erase all local records?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearAllData();
                  setConfirmClear(false);
                }}
                className="rounded-md bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-700"
              >
                Confirm Erase
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded-md bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
