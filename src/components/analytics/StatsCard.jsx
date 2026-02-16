export default function StatsCard({ title, value, icon: Icon, trend, color = "blue" }) {
    const colorClasses = {
        blue: "text-blue-600 bg-blue-100",
        green: "text-green-600 bg-green-100",
        purple: "text-purple-600 bg-purple-100",
        orange: "text-orange-600 bg-orange-100",
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex items-center justify-between transition-all hover:shadow-md">
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">{value}</h3>
                {trend && (
                    <p className={`text-xs mt-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {trend > 0 ? '+' : ''}{trend}% from last month
                    </p>
                )}
            </div>
            <div className={`p-3 rounded-full ${colorClasses[color] || colorClasses.blue}`}>
                {Icon && <Icon className="w-6 h-6" />}
            </div>
        </div>
    );
}
