from flask import Blueprint, jsonify, request
from app.handlers.alpaca_handler import AlpacaHandler

bp = Blueprint('trading', __name__, url_prefix='/api/trading')

# Initialize Alpaca handler
alpaca = AlpacaHandler()


@bp.route('/account', methods=['GET'])
def get_account():
    """Get Alpaca account information"""
    try:
        account_data = alpaca.get_account()
        return jsonify(account_data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/positions', methods=['GET'])
def get_positions():
    """Get all open positions"""
    try:
        positions = alpaca.get_positions()
        return jsonify({'positions': positions}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/positions/<symbol>', methods=['GET'])
def get_position(symbol):
    """Get a specific position"""
    try:
        position = alpaca.get_position(symbol.upper())
        if position:
            return jsonify(position), 200
        return jsonify({'error': 'Position not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/positions/<symbol>', methods=['DELETE'])
def close_position(symbol):
    """Close a position"""
    try:
        data = request.get_json() or {}
        qty = data.get('qty')
        result = alpaca.close_position(symbol.upper(), qty)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/orders', methods=['GET'])
def get_orders():
    """Get orders"""
    try:
        status = request.args.get('status', 'open')
        orders = alpaca.get_orders(status)
        return jsonify({'orders': orders}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    """Get a specific order"""
    try:
        order = alpaca.get_order(order_id)
        return jsonify(order), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/orders', methods=['POST'])
def place_order():
    """Place an order"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        symbol = data.get('symbol')
        qty = data.get('qty')
        side = data.get('side')
        order_type = data.get('type', 'market')
        limit_price = data.get('limit_price')
        
        if not all([symbol, qty, side]):
            return jsonify({'error': 'Missing required fields: symbol, qty, side'}), 400
        
        if order_type == 'limit':
            if not limit_price:
                return jsonify({'error': 'Limit price required for limit orders'}), 400
            order = alpaca.place_limit_order(symbol.upper(), float(qty), side, float(limit_price))
        else:
            order = alpaca.place_market_order(symbol.upper(), float(qty), side)
        
        return jsonify(order), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/orders/<order_id>', methods=['DELETE'])
def cancel_order(order_id):
    """Cancel an order"""
    try:
        result = alpaca.cancel_order(order_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/market/<symbol>', methods=['GET'])
def get_market_data(symbol):
    """Get market data for a symbol"""
    try:
        timeframe = request.args.get('timeframe', '1Day')
        days = int(request.args.get('days', 30))
        
        data = alpaca.get_market_data(symbol.upper(), timeframe, days)
        return jsonify({'symbol': symbol.upper(), 'data': data}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/quote/<symbol>', methods=['GET'])
def get_quote(symbol):
    """Get latest quote for a symbol"""
    try:
        quote = alpaca.get_quote(symbol.upper())
        if quote:
            return jsonify(quote), 200
        return jsonify({'error': 'Quote not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/portfolio/performance', methods=['GET'])
def get_portfolio_performance():
    """Get portfolio performance data"""
    try:
        account = alpaca.get_account()
        positions = alpaca.get_positions()
        
        total_pl = sum(float(pos['unrealized_pl']) for pos in positions)
        total_pl_percent = (total_pl / float(account['equity'])) * 100 if float(account['equity']) > 0 else 0
        
        performance = {
            'equity': float(account['equity']),
            'cash': float(account['cash']),
            'buying_power': float(account['buying_power']),
            'portfolio_value': float(account['portfolio_value']),
            'total_pl': total_pl,
            'total_pl_percent': total_pl_percent,
            'long_market_value': float(account['long_market_value']),
            'short_market_value': float(account['short_market_value']),
            'positions_count': len(positions),
        }
        
        return jsonify(performance), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
