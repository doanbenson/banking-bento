'use client'

import { useState, useEffect } from 'react'
import { PortfolioOverview } from '@/components/trading/PortfolioOverview'
import { PositionCard } from '@/components/trading/PositionCard'
import { OrderForm } from '@/components/trading/OrderForm'
import { StockChart } from '@/components/trading/StockChart'
import { TradeHistory } from '@/components/trading/TradeHistory'
import { tradingApi } from '@/lib/api-client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export default function TradingPage() {
  const [portfolioData, setPortfolioData] = useState<any>(null)
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    fetchData()
  }, [refreshTrigger])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [performance, positionsData] = await Promise.all([
        tradingApi.getPortfolioPerformance(),
        tradingApi.getPositions(),
      ])
      setPortfolioData(performance)
      setPositions(positionsData.positions || [])
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch trading data')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  const handleOrderPlaced = () => {
    // Refresh data after order is placed
    handleRefresh()
  }

  const handleClosePosition = async (symbol: string) => {
    if (window.confirm(`Are you sure you want to close your position in ${symbol}?`)) {
      try {
        await tradingApi.closePosition(symbol)
        handleRefresh()
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to close position')
      }
    }
  }

  if (loading && !portfolioData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading trading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error && !portfolioData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={handleRefresh}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trading Dashboard</h1>
          <p className="text-muted-foreground">Monitor and manage your paper trading portfolio</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {portfolioData && <PortfolioOverview data={portfolioData} />}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="positions">Positions ({positions.length})</TabsTrigger>
          <TabsTrigger value="trade">Trade</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <StockChart defaultSymbol="SPY" />
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Quick Trade</h2>
              <OrderForm onOrderPlaced={handleOrderPlaced} />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Active Positions</h2>
            {positions.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/50">
                <p className="text-muted-foreground">No active positions</p>
                <p className="text-sm text-muted-foreground mt-2">Place an order to start trading</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {positions.map((position) => (
                  <PositionCard
                    key={position.symbol}
                    position={position}
                    onClose={handleClosePosition}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">All Positions</h2>
            {positions.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/50">
                <p className="text-muted-foreground">No active positions</p>
                <p className="text-sm text-muted-foreground mt-2">Place an order to start trading</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {positions.map((position) => (
                  <PositionCard
                    key={position.symbol}
                    position={position}
                    onClose={handleClosePosition}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="trade" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <StockChart defaultSymbol="SPY" />
            </div>
            <div>
              <OrderForm onOrderPlaced={handleOrderPlaced} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <TradeHistory refreshTrigger={refreshTrigger} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

