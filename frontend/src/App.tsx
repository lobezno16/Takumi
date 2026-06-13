import { useHealth } from '@/api/health';

function App() {
  const { data, isError, isLoading } = useHealth();

  const isConnected = !isError && !isLoading && data?.status === 'ok';

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-8 p-8">
        {/* Logo */}
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-primary/20 blur-xl animate-pulse" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark shadow-lg shadow-primary/25">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 32 32"
              fill="none"
              className="h-10 w-10"
            >
              <path
                d="M8 24L16 8L24 24"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="16" cy="18" r="3" fill="white" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-text-primary">
            TakumiRoute
          </h1>
          <p className="mt-2 text-lg text-text-secondary">
            Delivery Optimization Engine
          </p>
        </div>

        {/* Health Status */}
        <div className="flex items-center gap-3 rounded-full border border-surface-lighter bg-surface-light px-5 py-2.5 shadow-md">
          <span className="relative flex h-3 w-3">
            {isConnected && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            )}
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                isConnected
                  ? 'bg-success'
                  : isLoading
                    ? 'bg-warning'
                    : 'bg-danger'
              }`}
            />
          </span>
          <span className="text-sm font-medium text-text-secondary">
            {isConnected
              ? `Backend connected — ${data.service}`
              : isLoading
                ? 'Connecting to backend…'
                : 'Backend unavailable'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
