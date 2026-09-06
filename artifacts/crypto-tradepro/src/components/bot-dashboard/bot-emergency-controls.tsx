import React, { useState } from 'react';
import {
  AlertTriangle,
  Pause,
  Play,
  Square,
  Slash,
  LogOut,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BotTrade, BotEmergencyAction } from './bot-types';

interface BotEmergencyControlsProps {
  runningTrade: BotTrade | null;
  onExecuteAction: (action: BotEmergencyAction, tradeId?: number) => Promise<{ success: boolean; message: string }>;
  isActionLoading?: boolean;
}

interface ActionMeta {
  action: BotEmergencyAction;
  title: string;
  badge: string;
  badgeVariant: 'default' | 'destructive' | 'outline' | 'secondary';
  description: string;
  consequence: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const ACTION_DEFINITIONS: Record<BotEmergencyAction, ActionMeta> = {
  pause: {
    action: 'pause',
    title: 'Pause Bot',
    badge: 'Graceful Stop',
    badgeVariant: 'secondary',
    description: 'Gracefully handles open trades per strategy exit rules, but stops opening any new trades.',
    consequence: 'Safer than full stop: does not strand your open position without its stop-loss / ROI rules.',
    icon: Pause,
    color: 'text-amber-400 border-amber-500/30 hover:bg-amber-500/10',
  },
  stopbuy: {
    action: 'stopbuy',
    title: 'Stop New Entries (Stopbuy)',
    badge: 'Selective Hold',
    badgeVariant: 'outline',
    description: 'Existing trades continue to manage themselves and exit normally, but no new buy signals are taken.',
    consequence: 'Best for market regime shifts where current positions are fine but you want zero new exposure.',
    icon: Slash,
    color: 'text-blue-400 border-blue-500/30 hover:bg-blue-500/10',
  },
  stop: {
    action: 'stop',
    title: 'Hard Stop Trader',
    badge: 'Immediate Stop',
    badgeVariant: 'destructive',
    description: 'Stops the trader process outright. The bot stops monitoring and executing until explicitly restarted.',
    consequence: 'Warning: Strategy