import { useStore } from "./store/useStore.js";
import Landing from "./pages/Landing.jsx";
import Loading from "./pages/Loading.jsx";
import Explorer from "./pages/Explorer.jsx";

export default function App() {
  const screen = useStore((s) => s.screen);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {screen === "landing" && <Landing />}
      {screen === "loading" && <Loading />}
      {screen === "explorer" && <Explorer />}
    </div>
  );
}
