import { create } from 'zustand';
import type {
  SimulationResult,
  MonteCarloResult,
  DetailedSimulationResult,
} from '@/api/client';

type Page = 'dashboard' | 'simulation' | 'map' | 'agent' | 'monte-carlo';

interface AppState {
  // Navigation
  currentPage: Page;
  setPage: (page: Page) => void;

  // Simulation results
  lastSimulation: SimulationResult | null;
  setLastSimulation: (result: SimulationResult | null) => void;

  lastMonteCarlo: MonteCarloResult | null;
  setLastMonteCarlo: (result: MonteCarloResult | null) => void;

  // Detailed run with geometry (shared by Map + Agent console)
  lastDetailed: DetailedSimulationResult | null;
  setLastDetailed: (result: DetailedSimulationResult | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  setPage: (page) => set({ currentPage: page }),

  lastSimulation: null,
  setLastSimulation: (result) => set({ lastSimulation: result }),

  lastMonteCarlo: null,
  setLastMonteCarlo: (result) => set({ lastMonteCarlo: result }),

  lastDetailed: null,
  setLastDetailed: (result) => set({ lastDetailed: result }),
}));
