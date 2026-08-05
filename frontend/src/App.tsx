import { useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import HelpModal from "./components/HelpModal";
import HomePage from "./pages/HomePage";
import SubjectsPage from "./pages/SubjectsPage";
import SubjectDetailPage from "./pages/SubjectDetailPage";
import CardsPage from "./pages/CardsPage";
import CardEditPage from "./pages/CardEditPage";
import PracticePage from "./pages/PracticePage";
import SettingsPage from "./pages/SettingsPage";
import {
  CardsIcon,
  HelpIcon,
  HomeIcon,
  PracticeIcon,
  SettingsIcon,
  SubjectsIcon,
} from "./components/Icons";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
    isActive ? "bg-blue-600 text-white" : "text-zinc-300 hover:bg-zinc-800"
  }`;

export default function App() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <span className="text-lg font-semibold text-blue-400">Flashcard</span>
        <nav className="ml-4 flex flex-1 gap-1">
          <NavLink to="/home" className={navClass}>
            <HomeIcon />
            Home
          </NavLink>
          <NavLink to="/subjects" className={navClass}>
            <SubjectsIcon />
            Subjects
          </NavLink>
          <NavLink to="/cards" className={navClass}>
            <CardsIcon />
            Cards
          </NavLink>
          <NavLink to="/practice" className={navClass}>
            <PracticeIcon />
            Practice
          </NavLink>
        </nav>
        <NavLink to="/settings" className={navClass}>
          <SettingsIcon />
          Settings
        </NavLink>
        <button
          onClick={() => setHelpOpen(true)}
          className="ml-1 inline-flex items-center rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          title="How Flashcard works"
          aria-label="Help"
        >
          <HelpIcon width={18} height={18} />
        </button>
      </header>

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
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
