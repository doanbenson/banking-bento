'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, DollarSign, Wallet, Activity } from "lucide-react"

interface PortfolioOverviewProps {
  data: {
    equity: number
    cash: number
    buying_power: number
    portfolio_value: number
    total_pl: number
    total_pl_percent: number
    long_market_value: number
    short_market_value: number
    positions_count: number
  }
}

export function PortfolioOverview({ data }: PortfolioOverviewProps) {
  const isPositive = data.total_pl >= 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${data.portfolio_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="flex items-center gap-2 mt-1">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              ${data.total_pl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({data.total_pl_percent.toFixed(2)}%)
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${data.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Available to trade
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Buying Power</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${data.buying_power.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Including margin
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.positions_count}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Market value: ${data.long_market_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
