import { Redirect, useLocalSearchParams } from 'expo-router';

/** 2.3's milestone screen is the event editor now (ADR-44); old links land there. */
export default function MilestoneRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/evento/[id]', params: { id } }} />;
}
