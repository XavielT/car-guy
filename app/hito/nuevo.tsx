import { Redirect, useLocalSearchParams } from 'expo-router';

/** 2.3's "Nuevo hito" is the event editor now (ADR-44), starting on the hito type. */
export default function NewMilestoneRedirect() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  return <Redirect href={{ pathname: '/evento/nuevo', params: { type: 'hito', ...(vehicleId ? { vehicleId } : {}) } }} />;
}
