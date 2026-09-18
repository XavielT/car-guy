import { BarChart } from 'react-native-gifted-charts';

import { fonts } from '@/constants/theme';
import type { MonthlyDistance } from '@/lib/domain/stats';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';
import { ChartFrame } from './ChartFrame';
import { compact } from './StackedBars';

const MONTH_INITIALS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * Kilometres per month, in the accent rather than a category colour: distance
 * is not a kind of spending, and borrowing `combustible`'s amber here would
 * imply the two bars are the same quantity seen twice.
 */
export function DistanceBars({ months }: { months: MonthlyDistance[] }) {
  const { theme } = useTheme();

  const hasData = months.some((month) => month.km > 0);
  const max = Math.max(...months.map((m) => m.km), 1);

  const data = months.map((month) => ({
    value: month.km,
    label: MONTH_INITIALS[month.monthIndex],
    frontColor: theme.accent,
  }));

  return (
    <ChartFrame
      title={es.stats.kmPerMonth}
      caption={es.stats.kmPerMonthCaption}
      empty={hasData ? undefined : es.stats.kmPerMonthEmpty}>
      {(width) => (
        <BarChart
          data={data}
          width={width - 56}
          height={130}
          barWidth={Math.max(14, Math.min(28, (width - 90) / months.length - 10))}
          spacing={10}
          initialSpacing={10}
          maxValue={max * 1.15}
          noOfSections={3}
          barBorderTopLeftRadius={4}
          barBorderTopRightRadius={4}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={theme.line}
          rulesColor={theme.line}
          rulesType="dashed"
          yAxisTextStyle={{ color: theme.text.muted, fontSize: 9, fontFamily: fonts.mono }}
          xAxisLabelTextStyle={{ color: theme.text.muted, fontSize: 10, fontFamily: fonts.medium }}
          yAxisLabelWidth={44}
          formatYLabel={(value: string) => compact(Number(value))}
          disablePress
        />
      )}
    </ChartFrame>
  );
}
