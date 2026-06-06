import { Redirect } from "expo-router";

export default function NotFoundScreen() {
  // If Expo Router ever gets confused (e.g. from state restoration or a weird deep link intent)
  // and tries to render a route that doesn't exist, we immediately redirect back to the root.
  // This bypasses the default Expo Router Sitemap screen which was crashing with the SystemInfo error.
  return <Redirect href="/" />;
}
