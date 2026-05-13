'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { accountsApi } from '@/lib/api-client';
import { transferApi } from '@/lib/api/services/transfer.service';
import type { Account } from '@/lib/api/types/domain';
import { formatCurrency } from '@/lib/formatters';

type TransferStatus = 'idle' | 'submitting' | 'success' | 'error';

function AccountOption({ account }: { account: Account }) {
  return (
    <option value={account.account_id}>
      {account.name}{account.mask ? ` •••• ${account.mask}` : ''} — {formatCurrency(account.balance.current)}
    </option>
  );
}

function TransferPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedFrom = searchParams.get('fromAccount');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromAccount, setFromAccount] = useState<string>('');
  const [toAccount, setToAccount] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [status, setStatus] = useState<TransferStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [transferResult, setTransferResult] = useState<{ executionId?: string; status?: string } | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await accountsApi.getAll();
        setAccounts(data || []);
        if (preselectedFrom) {
          setFromAccount(preselectedFrom);
        } else if (data && data.length > 0) {
          setFromAccount(data[0].account_id);
        }
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
      } finally {
        setLoading(false);
      }
    };
    void fetch();
  }, [preselectedFrom]);

  // Available destination accounts: anything except fromAccount
  const destinationAccounts = accounts.filter(a => a.account_id !== fromAccount);

  const fromAccountObj = accounts.find(a => a.account_id === fromAccount);
  const toAccountObj = accounts.find(a => a.account_id === toAccount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const amountNum = parseFloat(amount);
    if (!fromAccount || !toAccount) {
      setErrorMessage('Please select both source and destination accounts.');
      return;
    }
    if (fromAccount === toAccount) {
      setErrorMessage('Source and destination accounts must be different.');
      return;
    }
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setErrorMessage('Please enter a valid amount greater than $0.');
      return;
    }
    if (fromAccountObj?.balance.available !== null && fromAccountObj?.balance.available !== undefined) {
      if (amountNum > fromAccountObj.balance.available) {
        setErrorMessage(`Insufficient available balance. Available: ${formatCurrency(fromAccountObj.balance.available)}`);
        return;
      }
    }

    setStatus('submitting');
    try {
      const result = await transferApi.initiateTransfer({
        sourceAccountId: fromAccount,
        destinationAccountId: toAccount,
        amountMinor: Math.round(amountNum * 100), // convert to cents
        currency: 'USD',
        note: note || undefined,
      });
      setTransferResult(result);
      setStatus('success');
    } catch (err) {
      console.error('Transfer failed:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Transfer failed. Please try again.');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setTransferResult(null);
    setErrorMessage('');
    setAmount('');
    setNote('');
  };

  return (
    <>
      <div className="min-h-screen bg-transparent">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl lg:ml-64 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-xl hover:bg-surface-variant/30 transition-colors text-on-surface-variant"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div>
                <p className="text-sm text-muted-foreground">Transfers</p>
                <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Transfer Funds
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 pb-28 lg:ml-64 lg:px-12 lg:py-10">
          <div className="max-w-2xl mx-auto">

            {/* Success state */}
            {status === 'success' && (
              <div className="rounded-3xl bg-emerald-50 border border-emerald-200 p-10 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-emerald-600 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-emerald-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Transfer Initiated!
                  </h2>
                  <p className="text-emerald-700 mt-2">
                    {formatCurrency(parseFloat(amount))} from{' '}
                    <strong>{fromAccountObj?.name}</strong> → <strong>{toAccountObj?.name}</strong>
                  </p>
                  {transferResult?.executionId && (
                    <p className="text-xs text-emerald-600 mt-2 font-mono">
                      ID: {transferResult.executionId}
                    </p>
                  )}
                  {transferResult?.status && (
                    <span className="inline-block mt-2 text-[10px] bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                      {transferResult.status}
                    </span>
                  )}
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors"
                  >
                    New Transfer
                  </button>
                  <button
                    onClick={() => router.push('/')}
                    className="px-6 py-3 rounded-xl border border-emerald-300 text-emerald-700 font-bold hover:bg-emerald-50 transition-colors"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            )}

            {/* Transfer form */}
            {status !== 'success' && (
              <>
                {/* Info card */}
                <div className="bg-primary-container/20 rounded-3xl p-6 mb-8 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                    <span className="material-symbols-outlined">swap_horiz</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-on-primary-container" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      Inter-Account Transfer
                    </h2>
                    <p className="text-sm text-on-surface-variant">
                      Move funds between your linked accounts instantly.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">

                  {/* From account */}
                  <div className="bg-surface-container-lowest rounded-2xl p-6 space-y-3 border border-border/40">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant/70">
                      From Account
                    </label>
                    {loading ? (
                      <div className="h-10 rounded-xl bg-surface-variant animate-pulse" />
                    ) : (
                      <select
                        id="from-account"
                        value={fromAccount}
                        onChange={e => { setFromAccount(e.target.value); setToAccount(''); }}
                        className="w-full bg-background border border-border/60 rounded-xl px-4 py-3 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                        required
                      >
                        <option value="">Select source account…</option>
                        {accounts.map(a => <AccountOption key={a.account_id} account={a} />)}
                      </select>
                    )}
                    {fromAccountObj && (
                      <div className="flex gap-4 mt-2 text-xs text-on-surface-variant">
                        <span>Current: <strong>{formatCurrency(fromAccountObj.balance.current)}</strong></span>
                        {fromAccountObj.balance.available !== null && (
                          <span>Available: <strong>{formatCurrency(fromAccountObj.balance.available)}</strong></span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Swap arrow */}
                  <div className="flex justify-center">
                    <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined">arrow_downward</span>
                    </div>
                  </div>

                  {/* To account */}
                  <div className="bg-surface-container-lowest rounded-2xl p-6 space-y-3 border border-border/40">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant/70">
                      To Account
                    </label>
                    {loading ? (
                      <div className="h-10 rounded-xl bg-surface-variant animate-pulse" />
                    ) : (
                      <select
                        id="to-account"
                        value={toAccount}
                        onChange={e => setToAccount(e.target.value)}
                        className="w-full bg-background border border-border/60 rounded-xl px-4 py-3 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                        required
                      >
                        <option value="">Select destination account…</option>
                        {destinationAccounts.map(a => <AccountOption key={a.account_id} account={a} />)}
                      </select>
                    )}
                    {toAccountObj && (
                      <div className="flex gap-4 mt-2 text-xs text-on-surface-variant">
                        <span>Current: <strong>{formatCurrency(toAccountObj.balance.current)}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="bg-surface-container-lowest rounded-2xl p-6 space-y-3 border border-border/40">
                    <label htmlFor="amount" className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant/70">
                      Amount (USD)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-4 text-xl font-bold text-on-surface-variant/50">$</span>
                      <input
                        id="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full bg-background border border-border/60 rounded-xl pl-8 pr-4 py-3 text-2xl font-extrabold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 tracking-tight"
                        required
                      />
                    </div>

                    {/* Quick amounts */}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {[100, 500, 1000, 5000].map(q => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setAmount(String(q))}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-secondary-container/60 text-on-secondary-container hover:bg-secondary-container transition-colors"
                        >
                          ${q.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Note (optional) */}
                  <div className="bg-surface-container-lowest rounded-2xl p-6 space-y-3 border border-border/40">
                    <label htmlFor="note" className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant/70">
                      Note <span className="font-normal normal-case text-on-surface-variant/50">(optional)</span>
                    </label>
                    <input
                      id="note"
                      type="text"
                      maxLength={120}
                      placeholder="e.g. Rent, savings contribution…"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      className="w-full bg-background border border-border/60 rounded-xl px-4 py-3 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  {/* Error */}
                  {(status === 'error' || errorMessage) && (
                    <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 flex items-start gap-3">
                      <span className="material-symbols-outlined text-red-500 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                        error
                      </span>
                      <p className="text-sm text-red-700 font-medium">{errorMessage || 'Transfer failed. Please try again.'}</p>
                    </div>
                  )}

                  {/* Summary preview */}
                  {fromAccount && toAccount && amount && parseFloat(amount) > 0 && (
                    <div className="rounded-2xl bg-secondary-container/20 border border-secondary-container/40 px-5 py-4 space-y-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant/70">Transfer Summary</p>
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-on-surface-variant">From</span>
                        <span className="text-on-surface">{fromAccountObj?.name}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-on-surface-variant">To</span>
                        <span className="text-on-surface">{toAccountObj?.name}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="text-on-surface-variant">Amount</span>
                        <span className="text-primary text-lg">{formatCurrency(parseFloat(amount))}</span>
                      </div>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={status === 'submitting' || loading}
                    className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-extrabold text-base tracking-wide uppercase flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'submitting' ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                        Processing…
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">send_money</span>
                        Initiate Transfer
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default function TransferPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center lg:ml-64">
        <p className="text-muted-foreground">Loading transfer…</p>
      </div>
    }>
      <TransferPageContent />
    </Suspense>
  );
}
