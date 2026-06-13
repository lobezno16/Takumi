import { useHealth } from '@/api/health';
import { useMe } from '@/api/client';

export function DashboardPage() {
  const health = useHealth();
  const me = useMe();

  const services = [
    { name: 'Backend API', status: health.data?.status === 'ok', detail: health.data?.service ?? '—' },
    { name: 'PostgreSQL + PostGIS', status: health.data?.status === 'ok', detail: 'v16 + 3.4' },
    { name: 'Redis Cache', status: health.data?.status === 'ok', detail: 'Connected' },
  ];

  const features = [
    { icon: '🧠', title: 'ML Predictions', desc: 'LightGBM home-probability model with Platt calibration' },
    { icon: '🚚', title: 'Route Optimizer', desc: 'OR-Tools VRPTW with prize-collecting disjunctions' },
    { icon: '📊', title: 'Simulation Engine', desc: 'Monte Carlo baseline vs Takumi comparison' },
    { icon: '🗺️', title: 'OSRM Routing', desc: 'Real road-network travel times for Koto-ku' },
    { icon: '🔐', title: 'JWT Auth', desc: 'Argon2 password hashing with role-based access' },
    { icon: '⚡', title: 'Redis Cache', desc: 'Travel-time matrix caching with TTL' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h2 className="text-3xl font-bold text-text-primary">
          Welcome{me.data ? `, ${me.data.email.split('@')[0]}` : ''}
        </h2>
        <p className="mt-1 text-text-secondary">
          TakumiRoute Delivery Optimization Dashboard
        </p>
      </div>

      {/* Service Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {services.map((svc) => (
          <div key={svc.name} className="bg-surface-light rounded-xl border border-surface-lighter p-5">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                {svc.status && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                )}
                <span className={`relative inline-flex h-3 w-3 rounded-full ${svc.status ? 'bg-success' : 'bg-danger'}`} />
              </span>
              <div>
                <p className="text-sm font-medium text-text-primary">{svc.name}</p>
                <p className="text-xs text-text-secondary">{svc.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Feature Cards */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Platform Capabilities</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feat) => (
            <div
              key={feat.title}
              className="bg-surface-light rounded-xl border border-surface-lighter p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group"
            >
              <div className="text-2xl mb-3 group-hover:scale-110 transition-transform duration-300">{feat.icon}</div>
              <h4 className="text-sm font-semibold text-text-primary mb-1">{feat.title}</h4>
              <p className="text-xs text-text-secondary leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-gradient-to-br from-primary/10 to-primary-dark/10 rounded-xl border border-primary/20 p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">System Architecture</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: 'ORM Models', value: '11' },
            { label: 'API Endpoints', value: '20+' },
            { label: 'Test Coverage', value: '56' },
            { label: 'Build Phases', value: '7' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-primary">{stat.value}</div>
              <div className="text-xs text-text-secondary mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
