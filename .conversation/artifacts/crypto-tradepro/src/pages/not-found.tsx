import { Link } from 'wouter';
import { ArrowLeft, Crosshair } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[hsl(var(--background))] p-6">
      <div className="w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-md)]">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"><Crosshair size={20} /></span>
        <p className="mt-8 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[hsl(var(--muted-foreground))]">Desk error / 404</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">That panel is not on the board.</h1>
        <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">The route may have moved. Return to the market desk and pick a live surface.</p>
        <Link href="/" className="mt-7 inline-flex h-10 items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 text-xs font-bold text-[hsl(var(--primary-foreground))] transition-transform hover:brightness-105 active:translate-y-px" data-testid="link-return-market"><ArrowLeft size={14} /> Back to market</Link>
      </div>
    </div>
  );
}
