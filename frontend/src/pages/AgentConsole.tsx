import { useState, useCallback, useEffect } from 'react';
import {
  useCreateAgentSession,
  useSendAgentMessage,
  useReplan,
} from '@/api/client';
import type { AgentSession, AgentOrder } from '@/api/client';
import { useWebSocket } from '@/hooks/useWebSocket';
import { recipientFor, slotShort } from '@/lib/ops';
import { StatusBadge, PrimaryButton, Panel } from '@/components/ui';

type Bubble = { from: 'customer' | 'agent'; text: string };

// Example inbound customer messages an operator might receive.
const QUICK_MESSAGES = [
  "I'm only home after 6pm",
  'Mornings are best for me',
  'Can you come around noon?',
  'Please deliver this afternoon',
];

function orderIndex(orders: AgentOrder[], id: string): number {
  return Math.max(0, orders.findIndex((o) => o.order_id === id));
}

function NotificationRow({
  order,
  index,
  active,
  onClick,
}: {
  order: AgentOrder;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition-all ${active ? 'border-primary/30 bg-primary/10' : 'border-transparent hover:bg-surface-lighter/40'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-text-primary">{recipientFor(order.order_id, index)}</span>
        {order.assigned_slot ? (
          <StatusBadge label="Confirmed" tone="success" />
        ) : (
          <StatusBadge label="Needs window" tone="warning" />
        )}
      </div>
      <p className="mt-1 truncate text-xs text-text-secondary">{order.address}</p>
      <p className="mt-0.5 text-[11px] text-text-secondary">
        {order.assigned_slot
          ? `Window locked · ${slotShort(order.assigned_slot)}`
          : `Suggested window · ${slotShort(order.best_slot)}`}
      </p>
    </button>
  );
}

export function AgentConsole() {
  const createSession = useCreateAgentSession();
  const sendMessage = useSendAgentMessage();
  const replan = useReplan();
  const { isConnected, lastMessage } = useWebSocket('/ws/live');

  const [session, setSession] = useState<AgentSession | null>(null);
  const [orders, setOrders] = useState<AgentOrder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Map<string, Bubble[]>>(new Map());
  const [input, setInput] = useState('');
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    if (lastMessage?.type === 'route_update') {
      const d = lastMessage.data as { stops_visited: number; vehicles_used: number };
      setSyncMsg(`Routes updated — ${d.stops_visited} stops across ${d.vehicles_used} driver(s).`);
    }
  }, [lastMessage]);

  const handleStart = useCallback(() => {
    createSession.mutate(
      { n_orders: 6, day_of_week: 2 },
      {
        onSuccess: (s) => {
          setSession(s);
          setOrders(s.orders);
          setActiveId(s.orders[0]?.order_id ?? null);
          setThreads(new Map());
          setSyncMsg(null);
        },
      },
    );
  }, [createSession]);

  const send = useCallback(
    (text: string) => {
      if (!activeId || !text.trim()) return;
      const orderId = activeId;
      setThreads((t) => new Map(t).set(orderId, [...(t.get(orderId) ?? []), { from: 'customer', text }]));
      setInput('');
      sendMessage.mutate(
        { order_id: orderId, message: text, day_of_week: session?.day_of_week ?? 2 },
        {
          onSuccess: (res) => {
            setThreads((t) => new Map(t).set(orderId, [...(t.get(orderId) ?? []), { from: 'agent', text: res.reply }]));
            if (res.confirmed_slot) {
              setOrders((os) => os.map((o) => (o.order_id === orderId ? { ...o, assigned_slot: res.confirmed_slot } : o)));
            }
          },
        },
      );
    },
    [activeId, sendMessage, session],
  );

  const handleSync = useCallback(() => {
    if (!session) return;
    replan.mutate(
      { session_id: session.session_id, reason_code: 'window_changed' },
      { onSuccess: (r) => setSyncMsg(`Routes updated — ${r.stops_visited} stops across ${r.vehicles_used} driver(s).`) },
    );
  }, [replan, session]);

  const activeThread = activeId ? threads.get(activeId) ?? [] : [];
  const activeOrder = orders.find((o) => o.order_id === activeId) ?? null;
  const pending = orders.filter((o) => !o.assigned_slot).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Customer Communication Hub</h2>
          <p className="mt-0.5 text-sm text-text-secondary">Handle delivery-window requests and keep routes in sync</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-success' : 'bg-text-secondary/40'}`} />
            {isConnected ? 'Live sync' : 'Offline'}
          </span>
          <PrimaryButton onClick={handleStart} loading={createSession.isPending}>
            {session ? 'New Batch' : 'Open Inbox'}
          </PrimaryButton>
        </div>
      </div>

      {!session ? (
        <Panel className="p-10">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <div className="mb-4 text-5xl">💬</div>
            <h3 className="text-lg font-semibold text-text-primary">No active customer inbox</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Open today's delivery batch to review availability exceptions and confirm windows with recipients.
            </p>
            <PrimaryButton onClick={handleStart} loading={createSession.isPending} className="mt-5">Open Inbox</PrimaryButton>
          </div>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Notifications / exceptions */}
          <Panel
            title={`Exceptions (${pending})`}
            action={<span className="text-xs text-text-secondary">{orders.length} recipients</span>}
            className="lg:max-h-[600px] lg:overflow-hidden"
          >
            <div className="space-y-1.5 overflow-y-auto p-2 lg:max-h-[540px]">
              {orders.map((o, i) => (
                <NotificationRow
                  key={o.order_id}
                  order={o}
                  index={i}
                  active={o.order_id === activeId}
                  onClick={() => setActiveId(o.order_id)}
                />
              ))}
            </div>
          </Panel>

          {/* Chat stream */}
          <div className="lg:col-span-2">
            <div className="flex h-[600px] flex-col rounded-2xl border border-surface-lighter bg-surface-light">
              {/* thread header */}
              <div className="flex items-center justify-between border-b border-surface-lighter px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {activeOrder ? recipientFor(activeOrder.order_id, orderIndex(orders, activeOrder.order_id)) : 'Select a recipient'}
                  </p>
                  {activeOrder && <p className="text-xs text-text-secondary">{activeOrder.address}</p>}
                </div>
                {activeOrder?.assigned_slot && <StatusBadge label={`Confirmed · ${slotShort(activeOrder.assigned_slot)}`} tone="success" />}
              </div>

              {/* messages */}
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {activeThread.length === 0 && (
                  <div className="flex h-full items-center justify-center text-center text-sm text-text-secondary">
                    Reply to a customer's availability message — the assistant confirms the best window automatically.
                  </div>
                )}
                {activeThread.map((b, i) => (
                  <div key={i} className={`flex ${b.from === 'agent' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${b.from === 'agent' ? 'rounded-br-sm bg-success/90 text-white' : 'rounded-bl-sm bg-surface-lighter text-text-primary'}`}>
                      {b.text}
                    </div>
                  </div>
                ))}
                {sendMessage.isPending && (
                  <div className="flex justify-end">
                    <div className="rounded-2xl bg-success/40 px-3.5 py-2 text-sm text-white">…</div>
                  </div>
                )}
              </div>

              {/* composer */}
              <div className="space-y-2 border-t border-surface-lighter p-3">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_MESSAGES.map((m) => (
                    <button
                      key={m}
                      onClick={() => send(m)}
                      disabled={!activeId || sendMessage.isPending}
                      className="rounded-full border border-surface-lighter px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:bg-surface-lighter disabled:opacity-50"
                    >
                      “{m}”
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send(input)}
                    placeholder="Type the customer's message…"
                    className="flex-1 rounded-lg border border-surface-lighter bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    onClick={() => send(input)}
                    disabled={!activeId || sendMessage.isPending || !input.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route sync */}
      {session && (
        <Panel
          title="Route Sync"
          action={
            <PrimaryButton onClick={handleSync} loading={replan.isPending} className="!px-3 !py-1.5 !text-xs">
              {replan.isPending ? 'Syncing…' : 'Sync Confirmed Windows'}
            </PrimaryButton>
          }
        >
          <div className="px-5 py-4 text-sm">
            {syncMsg ? (
              <span className="inline-flex items-center gap-2 text-text-primary">
                <span className="text-success">✓</span> {syncMsg}
              </span>
            ) : (
              <span className="text-text-secondary">
                Confirm windows with recipients, then sync to push the updated stops to drivers in real time.
              </span>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
