from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest, LimitOrderRequest, GetOrdersRequest
from alpaca.trading.enums import OrderSide, TimeInForce, QueryOrderStatus
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest, StockLatestQuoteRequest
from alpaca.data.timeframe import TimeFrame
from datetime import datetime, timedelta
import os
from app.config import ALPACA_API_KEY, ALPACA_SECRET_KEY, ALPACA_PAPER


class AlpacaHandler:
    def __init__(self):
        """Initialize Alpaca clients"""
        self.trading_client = TradingClient(
            ALPACA_API_KEY, 
            ALPACA_SECRET_KEY, 
            paper=ALPACA_PAPER
        )
        self.data_client = StockHistoricalDataClient(
            ALPACA_API_KEY, 
            ALPACA_SECRET_KEY
        )

    def get_account(self):
        """Get account information"""
        try:
            account = self.trading_client.get_account()
            return {
                'id': str(account.id),
                'account_number': account.account_number,
                'status': account.status,
                'currency': account.currency,
                'buying_power': float(account.buying_power),
                'cash': float(account.cash),
                'portfolio_value': float(account.portfolio_value),
                'equity': float(account.equity),
                'last_equity': float(account.last_equity),
                'long_market_value': float(account.long_market_value),
                'short_market_value': float(account.short_market_value),
                'initial_margin': float(account.initial_margin),
                'maintenance_margin': float(account.maintenance_margin),
                'daytrade_count': account.daytrade_count,
                'daytrading_buying_power': float(account.daytrading_buying_power),
                'pattern_day_trader': account.pattern_day_trader,
            }
        except Exception as e:
            raise Exception(f"Error getting account: {str(e)}")

    def get_positions(self):
        """Get all open positions"""
        try:
            positions = self.trading_client.get_all_positions()
            return [{
                'symbol': pos.symbol,
                'qty': float(pos.qty),
                'avg_entry_price': float(pos.avg_entry_price),
                'current_price': float(pos.current_price),
                'market_value': float(pos.market_value),
                'cost_basis': float(pos.cost_basis),
                'unrealized_pl': float(pos.unrealized_pl),
                'unrealized_plpc': float(pos.unrealized_plpc),
                'unrealized_intraday_pl': float(pos.unrealized_intraday_pl),
                'unrealized_intraday_plpc': float(pos.unrealized_intraday_plpc),
                'side': pos.side,
                'exchange': pos.exchange,
            } for pos in positions]
        except Exception as e:
            raise Exception(f"Error getting positions: {str(e)}")

    def get_position(self, symbol: str):
        """Get a specific position"""
        try:
            position = self.trading_client.get_open_position(symbol)
            return {
                'symbol': position.symbol,
                'qty': float(position.qty),
                'avg_entry_price': float(position.avg_entry_price),
                'current_price': float(position.current_price),
                'market_value': float(position.market_value),
                'cost_basis': float(position.cost_basis),
                'unrealized_pl': float(position.unrealized_pl),
                'unrealized_plpc': float(position.unrealized_plpc),
                'side': position.side,
            }
        except Exception as e:
            return None

    def place_market_order(self, symbol: str, qty: float, side: str):
        """Place a market order"""
        try:
            order_side = OrderSide.BUY if side.upper() == 'BUY' else OrderSide.SELL
            market_order_data = MarketOrderRequest(
                symbol=symbol,
                qty=qty,
                side=order_side,
                time_in_force=TimeInForce.DAY
            )
            order = self.trading_client.submit_order(market_order_data)
            return self._format_order(order)
        except Exception as e:
            raise Exception(f"Error placing market order: {str(e)}")

    def place_limit_order(self, symbol: str, qty: float, side: str, limit_price: float):
        """Place a limit order"""
        try:
            order_side = OrderSide.BUY if side.upper() == 'BUY' else OrderSide.SELL
            limit_order_data = LimitOrderRequest(
                symbol=symbol,
                qty=qty,
                side=order_side,
                time_in_force=TimeInForce.DAY,
                limit_price=limit_price
            )
            order = self.trading_client.submit_order(limit_order_data)
            return self._format_order(order)
        except Exception as e:
            raise Exception(f"Error placing limit order: {str(e)}")

    def cancel_order(self, order_id: str):
        """Cancel an order"""
        try:
            self.trading_client.cancel_order_by_id(order_id)
            return {'status': 'cancelled', 'order_id': order_id}
        except Exception as e:
            raise Exception(f"Error cancelling order: {str(e)}")

    def get_orders(self, status='open'):
        """Get orders"""
        try:
            if status == 'open':
                request = GetOrdersRequest(status=QueryOrderStatus.OPEN)
            elif status == 'closed':
                request = GetOrdersRequest(status=QueryOrderStatus.CLOSED)
            else:
                request = GetOrdersRequest(status=QueryOrderStatus.ALL)
            
            orders = self.trading_client.get_orders(filter=request)
            return [self._format_order(order) for order in orders]
        except Exception as e:
            raise Exception(f"Error getting orders: {str(e)}")

    def get_order(self, order_id: str):
        """Get a specific order"""
        try:
            order = self.trading_client.get_order_by_id(order_id)
            return self._format_order(order)
        except Exception as e:
            raise Exception(f"Error getting order: {str(e)}")

    def get_market_data(self, symbol: str, timeframe='1Day', days=30):
        """Get historical market data"""
        try:
            # Map timeframe string to TimeFrame enum
            timeframe_map = {
                '1Min': TimeFrame.Minute,
                '5Min': TimeFrame(5, 'Min'),
                '15Min': TimeFrame(15, 'Min'),
                '1Hour': TimeFrame.Hour,
                '1Day': TimeFrame.Day,
            }
            
            tf = timeframe_map.get(timeframe, TimeFrame.Day)
            
            request_params = StockBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=tf,
                start=datetime.now() - timedelta(days=days)
            )
            
            bars = self.data_client.get_stock_bars(request_params)
            
            data = []
            if symbol in bars.data:
                for bar in bars.data[symbol]:
                    data.append({
                        'timestamp': bar.timestamp.isoformat(),
                        'open': float(bar.open),
                        'high': float(bar.high),
                        'low': float(bar.low),
                        'close': float(bar.close),
                        'volume': int(bar.volume),
                    })
            
            return data
        except Exception as e:
            raise Exception(f"Error getting market data: {str(e)}")

    def get_quote(self, symbol: str):
        """Get latest quote for a symbol"""
        try:
            request_params = StockLatestQuoteRequest(symbol_or_symbols=symbol)
            quotes = self.data_client.get_stock_latest_quote(request_params)
            
            if symbol in quotes:
                quote = quotes[symbol]
                return {
                    'symbol': symbol,
                    'ask_price': float(quote.ask_price),
                    'bid_price': float(quote.bid_price),
                    'ask_size': int(quote.ask_size),
                    'bid_size': int(quote.bid_size),
                    'timestamp': quote.timestamp.isoformat(),
                }
            return None
        except Exception as e:
            raise Exception(f"Error getting quote: {str(e)}")

    def close_position(self, symbol: str, qty: float = None):
        """Close a position (partial or full)"""
        try:
            if qty:
                self.trading_client.close_position(symbol, close_options={'qty': qty})
            else:
                self.trading_client.close_position(symbol)
            return {'status': 'closed', 'symbol': symbol}
        except Exception as e:
            raise Exception(f"Error closing position: {str(e)}")

    def _format_order(self, order):
        """Format order object to dictionary"""
        return {
            'id': str(order.id),
            'client_order_id': order.client_order_id,
            'symbol': order.symbol,
            'qty': float(order.qty) if order.qty else None,
            'filled_qty': float(order.filled_qty) if order.filled_qty else 0,
            'side': order.side.value,
            'type': order.type.value,
            'time_in_force': order.time_in_force.value,
            'limit_price': float(order.limit_price) if order.limit_price else None,
            'stop_price': float(order.stop_price) if order.stop_price else None,
            'filled_avg_price': float(order.filled_avg_price) if order.filled_avg_price else None,
            'status': order.status.value,
            'created_at': order.created_at.isoformat() if order.created_at else None,
            'updated_at': order.updated_at.isoformat() if order.updated_at else None,
            'submitted_at': order.submitted_at.isoformat() if order.submitted_at else None,
            'filled_at': order.filled_at.isoformat() if order.filled_at else None,
        }
