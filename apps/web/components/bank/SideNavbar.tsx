'use client';

import { usePathname, useRouter } from 'next/navigation';
import PlaidLinkButton from '@/components/bank/PlaidLinkButton';
import { Button } from '@/components/ui/button';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', href: '/', icon: 'dashboard' },
  { key: 'transfer', label: 'Transfer', href: '/transfer', icon: 'swap_horiz' },
  { key: 'transactions', label: 'Transactions', href: '/transaction', icon: 'receipt_long' },
  { key: 'wealth', label: 'Wealth', href: '/wealth', icon: 'insights' },
  { key: 'support', label: 'Support', href: '/support', icon: 'help_outline' },
];

export default function SideNavbar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActiveRoute = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleSelectTab = (href: string) => {
    router.push(href);
  };

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border/70 bg-sidebar/85 px-4 py-6 backdrop-blur-xl lg:flex lg:flex-col">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3 px-2 pt-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-slate-900">Intelligence</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Premium Tier</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = isActiveRoute(item.href);
            return (
              <button
                key={item.key}
                className={`flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all duration-200 text-left ${
                  isActive
                    ? 'bg-blue-50/30 text-blue-600 border-r-2 border-blue-400'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
                onClick={() => handleSelectTab(item.href)}
              >
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-2">
          <PlaidLinkButton
            onSuccess={(data) => console.log('Account linked successfully:', data)}
            onError={(error) => console.error('Link error:', error)}
            buttonText="Link New Bank"
          />
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 p-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-xl gap-1" style={{ gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}>
          {navItems.map((item) => {
            const isActive = isActiveRoute(item.href);
            return (
              <button
                key={item.key}
                className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all text-[10px] font-bold uppercase tracking-wide ${
                  isActive ? 'text-blue-600 bg-blue-50/30' : 'text-slate-500 hover:text-slate-900'
                }`}
                onClick={() => handleSelectTab(item.href)}
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="mx-auto mt-2 max-w-xl">
          <PlaidLinkButton
            onSuccess={(data) => console.log('Account linked successfully:', data)}
            onError={(error) => console.error('Link error:', error)}
            buttonText="Link New Bank"
          />
        </div>
      </div>
    </>
  );
}
