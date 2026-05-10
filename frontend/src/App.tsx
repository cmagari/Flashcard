import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import SubjectsPage from "./pages/SubjectsPage";
import SubjectDetailPage from "./pages/SubjectDetailPage";
import CardsPage from "./pages/CardsPage";
import CardEditPage from "./pages/CardEditPage";
import PracticePage from "./pages/PracticePage";
import SettingsPage from "./pages/SettingsPage";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded text-sm ${
    isActive ? "bg-blue-600 text-white" : "text-zinc-300 hover:bg-zinc-800"
  }`;

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <span className="text-lg font-semibold text-blue-400">Flashcard</span>
        <nav className="ml-4 flex flex-1 gap-1">
          <NavLink to="/cards" className={navClass}>Cards</NavLink>
          <NavLink to="/subjects" className={navClass}>Subjects</NavLink>
          <NavLink to="/practice" className={navClass}>Practice</NavLink>
        </nav>
        <NavLink to="/settings" className={navClass}>Settings</NavLink>
      </header>
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/cards" replace />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/cards/new" element={<CardEditPage />} />
          <Route path="/cards/:id" element={<CardEditPage />} />
          <Route path="/subjects" element={<SubjectsPage />} />
          <Route path="/subjects/:id" element={<SubjectDetailPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
