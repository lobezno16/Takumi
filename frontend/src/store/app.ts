import { create } from 'zustand';
import type { SimulationResult, MonteCarloResult } from '@/api/client';

type Page = 'dashboard' | 'simulation' | 'monte-carlo';

interface AppState {
  // Navigation
  currentPage: Page;
  setPage: (page: Page) => void;

  // Simulation results
  lastSimulation: SimulationResult | null;
  setLastSimulation: (result: SimulationResult | null) => void;

  lastMonteCarlo: MonteCarloResult | null;
  setLastMonteCarlo: (result: MonteCarloResult | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  setPage: (page) => set({ currentPage: page }),

  lastSimulation: null,
  setLastSimulation: (result) => set({ lastSimulation: result }),

  lastMonteCarlo: null,
  setLastMonteCarlo: (result) => set({ lastMonteCarlo: result }),
}));
