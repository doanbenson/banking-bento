'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { tradingApi } from '@/lib/api-client'
import { X } from 'lucide-react'

interface TradeHistoryProps {
  refreshTrigger?: number
}

export function TradeHistory({ refreshTrigger }: TradeHistoryProps) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open')

  useEffect(() => {
    fetchOrders()
  }, [filter, refreshTrigger])

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await tradingApi.getOrders(filter)
      setOrders(response.orders || [])
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch orders')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    try {
      await tradingApi.cancelOrder(orderId)
      fetchOrders()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel order')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'filled':
        return 'bg-green-500'
      case 'partially_filled':
        return 'bg-yellow-500'
      case 'canceled':
      case 'cancelled':
        return 'bg-gray-500'
      case 'rejected':
        return 'bg-red-500'
      case 'pending_new':
      case 'accepted':
      case 'new':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getSideColor = (side: string) => {
    return side.toLowerCase() === 'buy' ? 'text-green-600' : 'text-red-600'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Orders & Trades</CardTitle>
            <CardDescription>View and manage your trading orders</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'open' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('open')}
            >
              Open
            </Button>
            <Button
              variant={filter === 'closed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('closed')}
            >
              Closed
            </Button>
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading orders...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-red-500">{error}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">No orders found</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Filled</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.symbol}</TableCell>
                    <TableCell>
                      <span className={`font-semibold ${getSideColor(order.side)}`}>
                        {order.side.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>{order.type.toUpperCase()}</TableCell>
                    <TableCell>{order.qty}</TableCell>
                    <TableCell>{order.filled_qty || 0}</TableCell>
                    <TableCell>
                      {order.filled_avg_price 
                        ? `$${parseFloat(order.filled_avg_price).toFixed(2)}`
                        : order.limit_price 
                        ? `$${parseFloat(order.limit_price).toFixed(2)}`
                        : 'Market'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {order.created_at ? new Date(order.created_at).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      {(order.status === 'new' || order.status === 'accepted' || order.status === 'pending_new') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelOrder(order.id)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
