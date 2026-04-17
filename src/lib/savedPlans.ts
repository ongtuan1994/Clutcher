export type SavedPlan = {
  id: string;
  variant: 'short' | 'long';
  goalId: string;
  budget: number;
  year: number;
  month: number;
  createdAt: number;
  /** Short-term: free text (e.g. destination) */
  details?: string;
  /** Long-term: lump sum already committed / down payment */
  initialCapital?: number;
  /** Long-term: planned monthly contribution */
  monthlyPayment?: number;
};

const STORAGE_KEY = 'sg_saved_plans_v1';

type PlanStore = Record<string, SavedPlan[]>;

function readStore(): PlanStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PlanStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: PlanStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent('sg-plans-changed'));
}

export function loadPlansForUser(userId: string): SavedPlan[] {
  const store = readStore();
  return [...(store[userId] || [])].sort((a, b) => b.createdAt - a.createdAt);
}

export function addPlan(userId: string, plan: Omit<SavedPlan, 'id' | 'createdAt'>): SavedPlan {
  const store = readStore();
  const list = store[userId] || [];
  const row: SavedPlan = {
    ...plan,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
  };
  store[userId] = [row, ...list];
  writeStore(store);
  return row;
}

export function removePlan(userId: string, planId: string): void {
  const store = readStore();
  const list = store[userId];
  if (!list) return;
  store[userId] = list.filter((p) => p.id !== planId);
  writeStore(store);
}
