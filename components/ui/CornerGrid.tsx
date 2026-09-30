import { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { fonts, radius, space } from "@/constants/theme";
import { t } from "@/lib/i18n";
import { useTheme } from "@/lib/theme/useTheme";
import { T } from "../T";

/**
 * Per-corner input on a car seen from above (05-design-jdm.md §10): tire
 * pressures, ride heights, camber. Tap a corner, type, "next" moves
 * DI → DD → TI → TD. With `compare` (the cold reading) each corner shows the
 * delta, and a rear delta over `flagDelta` turns red — the "rears grew" warning
 * a drift day needs.
 */
export type Corner = "fl" | "fr" | "rl" | "rr";
export type CornerValues = Partial<Record<Corner, number | null>>;

const ORDER: Corner[] = ["fl", "fr", "rl", "rr"];

export function CornerGrid({
  values,
  onChange,
  unit = "psi",
  compare,
  flagDelta,
  editable = true,
}: {
  values: CornerValues;
  onChange?: (corner: Corner, value: number | null) => void;
  unit?: string;
  /** Baseline per corner (e.g. cold pressures); shows value − baseline. */
  compare?: CornerValues;
  /** Rear deltas above this are highlighted (spec: +8 psi). */
  flagDelta?: number;
  editable?: boolean;
}) {
  const { theme } = useTheme();
  const refs = useRef<Partial<Record<Corner, TextInput | null>>>({});

  const cell = (corner: Corner) => {
    const value = values[corner];
    const base = compare?.[corner];
    const delta = value != null && base != null ? value - base : null;
    const rear = corner === "rl" || corner === "rr";
    const flagged =
      delta != null && flagDelta != null && rear && delta > flagDelta;
    const next = ORDER[ORDER.indexOf(corner) + 1];

    return (
      <View
        key={corner}
        style={[
          styles.cell,
          {
            backgroundColor: theme.bg.well,
            borderColor: flagged ? theme.redline : theme.lineStrong,
          },
        ]}
      >
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10 }}>
          {t.corners[corner]}
        </T>
        <TextInput
          ref={(r) => {
            refs.current[corner] = r;
          }}
          editable={editable}
          value={value == null ? "" : String(value)}
          onChangeText={(text) => {
            const n = Number(text.replace(",", "."));
            onChange?.(
              corner,
              text.trim() === "" || !Number.isFinite(n) ? null : n,
            );
          }}
          keyboardType="decimal-pad"
          returnKeyType={next ? "next" : "done"}
          onSubmitEditing={() => next && refs.current[next]?.focus()}
          blurOnSubmit={!next}
          placeholder="—"
          placeholderTextColor={theme.text.disabled}
          accessibilityLabel={`${t.corners.long[corner]} (${unit})`}
          style={[
            styles.input,
            { color: theme.text.primary, fontFamily: fonts.monoBold },
          ]}
        />
        <T
          face="mono"
          style={{
            color: flagged ? theme.redlineText : theme.text.muted,
            fontSize: 11,
          }}
        >
          {delta == null
            ? unit
            : `${delta > 0 ? "+" : ""}${round(delta)} ${unit}`}
        </T>
      </View>
    );
  };

  return (
    <View style={styles.grid}>
      <View style={styles.col}>
        {cell("fl")}
        {cell("rl")}
      </View>
      {/* The car, from above: just enough of a silhouette to say "front is up". */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width={44} height={132} viewBox="0 0 44 132">
          <Rect
            x={6}
            y={4}
            width={32}
            height={124}
            rx={12}
            fill="none"
            stroke={theme.lineStrong}
            strokeWidth={2}
          />
          <Rect
            x={11}
            y={26}
            width={22}
            height={18}
            rx={3}
            fill="none"
            stroke={theme.lineStrong}
            strokeWidth={1.5}
          />
          <Rect
            x={11}
            y={88}
            width={22}
            height={14}
            rx={3}
            fill="none"
            stroke={theme.lineStrong}
            strokeWidth={1.5}
          />
        </Svg>
      </View>
      <View style={styles.col}>
        {cell("fr")}
        {cell("rr")}
      </View>
    </View>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
  },
  col: { gap: space.md },
  cell: {
    width: 104,
    borderRadius: radius.input,
    borderWidth: 1,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    alignItems: "center",
  },
  input: {
    fontSize: 22,
    minWidth: 64,
    textAlign: "center",
    paddingVertical: 2,
  },
});
