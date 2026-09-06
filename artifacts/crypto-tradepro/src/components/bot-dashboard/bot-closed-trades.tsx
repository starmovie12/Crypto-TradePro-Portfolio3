import React, { useState } from 'react';
import { BotClosedTrade } from './bot-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface BotClosedTradesProps {
  trades: BotClosedTrade[];
  currency