export type BotConnectionState =
  | 'not_connected'
  | 'waking_up'
  | 'cors_blocked'
  | 'auth_failed'
  | 'unreachable'
  | 'connected';

export interface StrategyWebhookData {
  regime?: string;
  entry_adaptive_sl?: number;
  checkpoint_sl?: number;
  final_checkpoint_sl?: number;
  checkpoint_vol_ratio?: number;
  iv_move_at_checkpoint?: number;
  premium_sl_pts?: number;
}

export interface BotRunningTrade {
  trade_id: number | string;
  pair: string;
  side: 'LONG' | 'SHORT';
  open_date: string;
  open_timestamp: number;
  open_rate: number;
  current_rate: number;
  amount: number;
  stake_amount: number;
  unrealized_profit_ratio: number;
  unrealized_profit_usdt: number;
  unrealized_profit_inr: number;
  strategy_data?: StrategyWebhookData;
  day_high?: number;
  day_low?: number;
}

export interface BotClosedTrade {
  trade_id: number | string;
  pair: string;
  side: 'LONG' | 'SHORT';
  open_date: string;
  close_date: string;
  open_rate: number;
  close_rate: number;
  amount: number;
  stake_amount: number;
  close_profit_ratio: number;
  close_profit_usdt: number;
  close_profit_inr: number;
  exit_reason: string;
  strategy_data?: StrategyWebhookData;
  day_high?: number;
  day_low?: number;
}

export interface BotMetrics {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate_pct: number;
  profit_factor: number;
  total_profit_usdt: number;
  total_profit_inr: number;
  bot_balance_usdt: number;
  bot_balance_inr: number;
  is_dry_run: boolean;
}

export type EmergencyActionType = 'pause' | 'stop' | 'stopbuy' | 'start' | 'forceexit';
