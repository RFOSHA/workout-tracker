export function getWeeklyChartData(
    data: any,
    filter: string,
    metric: 'sets' | 'volume' = 'sets'
) {
    if (!data?.weeklyBreakdown?.length) return { bars: [], max: 10 };

    const bars = data.weeklyBreakdown.map((w: any) => {
        let count = 0;
        if (metric === 'volume') {
            count = filter === 'All'
                ? (w.volume || 0)
                : (w.muscleVolumes?.[filter] || 0);
        } else {
            count = filter === 'All'
                ? w.total
                : (w.muscles[filter] || 0);
        }
        return { week: w.week, count };
    });

    const max = Math.max(...bars.map((b: any) => b.count)) || 10;
    return { bars, max };
}