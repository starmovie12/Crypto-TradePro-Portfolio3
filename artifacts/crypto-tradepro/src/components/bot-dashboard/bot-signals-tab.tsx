import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BotTrade,
  BotRunningTrade as BotRunningTradeType,
  BotClosedTrade,
  BotBalance,
  BotProfit,
  BotConnectionState,
  StrategyWebhookData,
  BotEmergencyAction,
} from './bot-types';
import { BotRunningTrade } from './bot-running-trade';
import { BotClosedTrades } from './bot-closed-trades';
import { BotEmergencyControls } from './bot-emergency-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  PieChart,
  Shield,
  Clock,
  ExternalLink,
  Sliders,
  DollarSign,
  AlertOctagon,
  Layers,
  X,
} from 'lucide-react';

interface BotSignalsTabProps {
  currencyRate: number;
  onOpenSettings?: () => void;
}

export function BotSignalsTab({
  currencyRate,
  onOpenSettings,
}: BotSignalsTabProps) {
  // Connection state & credentials
  const [connectionState, setConnectionState] = useState<BotConnectionState>('not_configured');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dbResetWarning, setDbResetWarning]