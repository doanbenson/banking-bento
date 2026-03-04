'use client'

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { tradingApi } from "@/lib/api-client"

interface OrderFormProps {
  onOrderPlaced?: () => void
}

export function OrderForm({ onOrderPlaced }: OrderFormProps) {
  const [symbol, setSymbol] = useState('')
  const [qty, setQty] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quote, setQuote] = useState<any>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)

  const fetchQuote = async () => {
    if (!symbol) return
    
    setLoadingQuote(true)
    try {
      const quoteData = await tradingApi.getQuote(symbol.toUpperCase())
      setQuote(quoteData)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch quote')
      setQuote(null)
    } finally {
      setLoadingQuote(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const orderData: any = {
        symbol: symbol.toUpperCase(),
        qty: parseFloat(qty),
        side,
        type: orderType,
      }

      if (orderType === 'limit') {
        orderData.limit_price = parseFloat(limitPrice)
      }

      await tradingApi.placeOrder(orderData)
      
      // Reset form
      setSymbol('')
      setQty('')
      setLimitPrice('')
      setQuote(null)
      
      if (onOrderPlaced) {
        onOrderPlaced()
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to place order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Place Order</CardTitle>
        <CardDescription>Enter order details to execute a trade</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant={side === 'buy' ? 'default' : 'outline'}
              onClick={() => setSide('buy')}
              className={side === 'buy' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              Buy
            </Button>
            <Button
              type="button"
              variant={side === 'sell' ? 'default' : 'outline'}
              onClick={() => setSide('sell')}
              className={side === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              Sell
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="symbol">Symbol</Label>
            <div className="flex gap-2">
              <Input
                id="symbol"
                placeholder="AAPL"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={fetchQuote}
                disabled={!symbol || loadingQuote}
              >
                {loadingQuote ? 'Loading...' : 'Quote'}
              </Button>
            </div>
          </div>

          {quote && (
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bid</span>
                <span className="font-semibold">${quote.bid_price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ask</span>
                <span className="font-semibold">${quote.ask_price.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="qty">Quantity</Label>
            <Input
              id="qty"
              type="number"
              placeholder="10"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              min="1"
              step="1"
              required
            />
          </div>

          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant={orderType === 'market' ? 'default' : 'outline'}
              onClick={() => setOrderType('market')}
              size="sm"
            >
              Market
            </Button>
            <Button
              type="button"
              variant={orderType === 'limit' ? 'default' : 'outline'}
              onClick={() => setOrderType('limit')}
              size="sm"
            >
              Limit
            </Button>
          </div>

          {orderType === 'limit' && (
            <div className="space-y-2">
              <Label htmlFor="limitPrice">Limit Price</Label>
              <Input
                id="limitPrice"
                type="number"
                placeholder="150.00"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                step="0.01"
                min="0.01"
                required
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Placing Order...' : `Place ${side.toUpperCase()} Order`}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
