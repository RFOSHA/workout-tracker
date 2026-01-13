export function getWeeklyChartData(data: any, filter: string) {
    if (!data || !data.weeklyBreakdown || data.weeklyBreakdown.length === 0) return { bars: [], max: 10 };
    const bars = data.weeklyBreakdown.map((w: any) => {
        let count = 0;
        if (filter === "All") {
            count = w.total;
        } else {
            count = w.muscles[filter] || 0;
        }
        return { week: w.week, count };
    });
    const max = Math.max(...bars.map((b: any) => b.count)) || 10;
    return { bars, max };
  }