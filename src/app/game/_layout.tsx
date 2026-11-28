import { Stack } from 'expo-router';
import { SessionGate } from '../../auth/SessionGate';

export default function GameLayout() {
  return <SessionGate><Stack screenOptions={{ headerShown: false, animation: "ios_from_right" }} /></SessionGate>;
}
