import Card from './ui/Card';

export default function StatCard({ title, value, badge, icon: Icon, color = 'blue' }) {
  const colorStyles = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-emerald-600 bg-emerald-50',
    orange: 'text-orange-600 bg-orange-50',
    red: 'text-red-600 bg-red-50',
  };

  return (
    <Card className="flex flex-col justify-between h-full border-none shadow-md hover:shadow-lg transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
            {title}
          </p>
        </div>

        {badge && (
          <span
            className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${
              badge === 'LIVE'
                ? 'bg-green-100 text-green-700'
                : badge === 'ALERT'
                ? 'bg-red-100 text-red-700'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <h3 className="text-3xl font-bold text-slate-800">
          {value}
        </h3>

        {Icon && (
          <div className={`p-2 rounded-lg ${colorStyles[color]}`}>
            <Icon size={24} />
          </div>
        )}
      </div>
    </Card>
  );
}