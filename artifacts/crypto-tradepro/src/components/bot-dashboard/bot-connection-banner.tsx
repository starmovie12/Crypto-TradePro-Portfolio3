import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, RefreshCw, ServerCrash, ShieldAlert } from 'lucide-react';
import { BotConnectionState } from './bot-types';
import { Button } from '../ui/button';

interface BotConnectionBannerProps {
  state: BotConnectionState;
  hasPersistentDb?: boolean;
  onRetry?: () => void;
  onOpenSettings?: () => void;
  isRetrying?: boolean;
}

export const BotConnectionBanner: React.FC<BotConnectionBannerProps> = ({
  state,
  hasPersistentDb = true,
  onRetry,
  onOpenSettings,
  isRetrying = false,
}) => {
  if (state === 'connected' && hasPersistentDb) {
    return null;
  }

  return (
    <div className="space-y-2 mb-4">
      {state === 'not_connected' && (
        <div className="flex items-start justify-between p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-200">Bot Not Connected</p>
              <p className="text-xs text-amber-300/